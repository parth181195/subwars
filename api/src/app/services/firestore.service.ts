import { Injectable, Inject } from '@nestjs/common';
import { Firestore, Timestamp, CollectionReference, Query, DocumentData } from 'firebase-admin/firestore';

/**
 * Base Firestore service providing common database operations
 * Replaces Supabase client functionality with Firestore operations
 */
@Injectable()
export class FirestoreService {
  constructor(@Inject('FIRESTORE') private db: Firestore) {}

  /**
   * Convert Firestore Timestamp to ISO string
   */
  private timestampToString(timestamp: any): string {
    if (timestamp?.toDate) {
      return timestamp.toDate().toISOString();
    }
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    if (typeof timestamp === 'string') {
      return timestamp;
    }
    return new Date().toISOString();
  }

  /**
   * Convert ISO string or Date to Firestore Timestamp
   */
  private stringToTimestamp(date: string | Date | undefined): Timestamp | undefined {
    if (!date) return undefined;
    if (date instanceof Date) {
      return Timestamp.fromDate(date);
    }
    if (typeof date === 'string') {
      return Timestamp.fromDate(new Date(date));
    }
    return undefined;
  }

  /**
   * Convert document data with Firestore Timestamps to plain objects
   */
  private convertTimestamps(data: any): any {
    if (!data) return data;
    
    if (Array.isArray(data)) {
      return data.map(item => this.convertTimestamps(item));
    }

    if (data.toDate && typeof data.toDate === 'function') {
      return data.toDate().toISOString();
    }

    if (typeof data === 'object' && data !== null) {
      const converted: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && 'toDate' in value) {
          converted[key] = (value as Timestamp).toDate().toISOString();
        } else if (Array.isArray(value)) {
          converted[key] = value.map(item => this.convertTimestamps(item));
        } else if (value && typeof value === 'object') {
          converted[key] = this.convertTimestamps(value);
        } else {
          converted[key] = value;
        }
      }
      return converted;
    }

    return data;
  }

  /**
   * Prepare data for Firestore (convert dates to Timestamps, filter undefined values, etc.)
   */
  private prepareData(data: any): any {
    if (!data) return data;

    if (Array.isArray(data)) {
      return data.map(item => this.prepareData(item));
    }

    if (typeof data === 'object' && data !== null) {
      const prepared: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Skip id field (Firestore uses document ID)
        if (key === 'id') continue;
        
        // Skip undefined values (Firestore doesn't accept undefined)
        if (value === undefined) continue;
        
        // Convert date strings to Timestamps
        if ((key === 'created_at' || key === 'updated_at' || key === 'started_at' || 
             key === 'ended_at' || key === 'submitted_at' || key === 'scraped_at') && value) {
          prepared[key] = this.stringToTimestamp(value as string);
        } else if (key === 'scheduled_at' && value) {
          prepared[key] = this.stringToTimestamp(value as string);
        } else if (Array.isArray(value)) {
          prepared[key] = value.map(item => this.prepareData(item));
        } else if (value && typeof value === 'object') {
          prepared[key] = this.prepareData(value);
        } else {
          prepared[key] = value;
        }
      }
      return prepared;
    }

    return data;
  }

  /**
   * Get a collection reference
   */
  collection(path: string): CollectionReference<DocumentData> {
    return this.db.collection(path);
  }

  /**
   * Get a document reference
   */
  doc(collectionPath: string, docId?: string) {
    if (docId) {
      return this.db.collection(collectionPath).doc(docId);
    }
    return this.db.collection(collectionPath).doc();
  }

  /**
   * Create a document
   */
  async create<T>(collectionPath: string, data: Omit<T, 'id' | 'created_at' | 'updated_at'>, docId?: string): Promise<T> {
    const docRef = docId ? this.doc(collectionPath, docId) : this.doc(collectionPath);
    const now = Timestamp.now();
    
    const docData = {
      ...this.prepareData(data),
      created_at: now,
      updated_at: now,
    };

    await docRef.set(docData);
    
    const snapshot = await docRef.get();
    return {
      id: snapshot.id,
      ...this.convertTimestamps(snapshot.data()),
    } as T;
  }

  /**
   * Get a document by ID
   */
  async getById<T>(collectionPath: string, id: string): Promise<T | null> {
    const docRef = this.doc(collectionPath, id);
    const snapshot = await docRef.get();
    
    if (!snapshot.exists) {
      return null;
    }

    return {
      id: snapshot.id,
      ...this.convertTimestamps(snapshot.data()),
    } as T;
  }

  /**
   * Batch get multiple documents by IDs (much faster than individual gets)
   * Firestore supports up to 10 documents per batch get, so we chunk if needed
   */
  async getBatchByIds<T>(collectionPath: string, ids: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    
    if (ids.length === 0) {
      return result;
    }

    // Firestore getAll() supports up to 10 documents per call
    // Chunk into batches of 10
    const batchSize = 10;
    const chunks: string[][] = [];
    
    for (let i = 0; i < ids.length; i += batchSize) {
      chunks.push(ids.slice(i, i + batchSize));
    }

    // Fetch all chunks in parallel
    await Promise.all(
      chunks.map(async (chunk) => {
        const docRefs = chunk.map(id => this.doc(collectionPath, id));
        const snapshots = await this.db.getAll(...docRefs);
        
        snapshots.forEach(snapshot => {
          if (snapshot.exists) {
            result.set(snapshot.id, {
              id: snapshot.id,
              ...this.convertTimestamps(snapshot.data()),
            } as T);
          }
        });
      })
    );

    return result;
  }

  /**
   * Update a document
   */
  async update<T>(collectionPath: string, id: string, data: Partial<T>): Promise<T> {
    const docRef = this.doc(collectionPath, id);
    const updateData = {
      ...this.prepareData(data),
      updated_at: Timestamp.now(),
    };

    await docRef.update(updateData);
    
    const snapshot = await docRef.get();
    return {
      id: snapshot.id,
      ...this.convertTimestamps(snapshot.data()),
    } as T;
  }

  /**
   * Delete a document
   */
  async delete(collectionPath: string, id: string): Promise<void> {
    const docRef = this.doc(collectionPath, id);
    await docRef.delete();
  }

  /**
   * Query documents with filters
   */
  async query<T>(
    collectionPath: string,
    filters?: Array<{ field: string; operator: '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in' | 'array-contains-any'; value: any }>,
    orderBy?: { field: string; direction: 'asc' | 'desc' },
    limit?: number
  ): Promise<T[]> {
    let query: Query<DocumentData> = this.collection(collectionPath);

    // Apply filters
    if (filters) {
      for (const filter of filters) {
        query = query.where(filter.field, filter.operator, filter.value);
      }
    }

    // Apply ordering
    if (orderBy) {
      query = query.orderBy(orderBy.field, orderBy.direction);
    }

    // Apply limit
    if (limit) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...this.convertTimestamps(doc.data()),
    })) as T[];
  }

  /**
   * Get a single document matching filters
   */
  async getOne<T>(
    collectionPath: string,
    filters?: Array<{ field: string; operator: '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in' | 'array-contains-any'; value: any }>
  ): Promise<T | null> {
    const results = await this.query<T>(collectionPath, filters, undefined, 1);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Batch write operations
   */
  batch() {
    return this.db.batch();
  }

  /**
   * Run a transaction
   */
  async runTransaction<T>(updateFunction: (transaction: FirebaseFirestore.Transaction) => Promise<T>): Promise<T> {
    return this.db.runTransaction(updateFunction);
  }
}

