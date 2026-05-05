import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions, Order, Transaction, QueryTypes, Sequelize as SequelizeType } from 'sequelize';
import { UserModel } from '../models/user.model';
import { QuizModel } from '../models/quiz.model';
import { QuestionModel } from '../models/question.model';
import { AnswerModel } from '../models/answer.model';
import { VoiceLineModel } from '../models/voice-line.model';

/**
 * PostgreSQL service using Sequelize ORM
 * Replaces FirestoreService with SQL-based operations
 */
@Injectable()
export class PostgresService {
  constructor(
    @InjectModel(UserModel)
    private userModel: typeof UserModel,
    @InjectModel(QuizModel)
    private quizModel: typeof QuizModel,
    @InjectModel(QuestionModel)
    private questionModel: typeof QuestionModel,
    @InjectModel(AnswerModel)
    private answerModel: typeof AnswerModel,
    @InjectModel(VoiceLineModel)
    private voiceLineModel: typeof VoiceLineModel,
  ) {}

  // ========== Generic CRUD Operations ==========

  /**
   * Get a document by ID
   */
  async getById<T>(collectionPath: string, id: string): Promise<T | null> {
    const model = this.getModel(collectionPath);
    const result = await (model as any).findByPk(id);
    return result ? this.convertToPlainObject(result) as T : null;
  }

  /**
   * Create a document
   */
  async create<T>(
    collectionPath: string,
    data: Partial<T>,
    id?: string,
    transaction?: Transaction
  ): Promise<T> {
    const model = this.getModel(collectionPath);
    const createData: any = { ...data };
    if (id) {
      createData.id = id;
    }
    const result = await (model as any).create(createData, { transaction });
    return this.convertToPlainObject(result) as T;
  }

  /**
   * Update a document
   */
  async update<T>(
    collectionPath: string,
    id: string,
    data: Partial<T>,
    transaction?: Transaction
  ): Promise<T> {
    const model = this.getModel(collectionPath);
    const instance = await (model as any).findByPk(id, { transaction });
    if (!instance) {
      throw new Error(`Document with ID ${id} not found`);
    }
    await instance.update(data as any, { transaction });
    return this.convertToPlainObject(instance) as T;
  }

  /**
   * Delete a document
   */
  async delete(
    collectionPath: string,
    id: string,
    transaction?: Transaction
  ): Promise<void> {
    const model = this.getModel(collectionPath);
    const options: any = { where: { id } };
    if (transaction) {
      options.transaction = transaction;
    }
    await (model as any).destroy(options);
  }

  /**
   * Query documents with filters
   */
  async query<T>(
    collectionPath: string,
    filters?: Array<{ field: string; operator: '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in' | 'array-contains-any'; value: any }>,
    orderBy?: { field: string; direction: 'asc' | 'desc' },
    limit?: number,
    transaction?: Transaction
  ): Promise<T[]> {
    const model = this.getModel(collectionPath);
    const where: WhereOptions = {};
    
    if (filters) {
      for (const filter of filters) {
        switch (filter.operator) {
          case '==':
            where[filter.field] = filter.value;
            break;
          case '!=':
            where[filter.field] = { [Op.ne]: filter.value };
            break;
          case '<':
            where[filter.field] = { [Op.lt]: filter.value };
            break;
          case '<=':
            where[filter.field] = { [Op.lte]: filter.value };
            break;
          case '>':
            where[filter.field] = { [Op.gt]: filter.value };
            break;
          case '>=':
            where[filter.field] = { [Op.gte]: filter.value };
            break;
          case 'in':
            where[filter.field] = { [Op.in]: filter.value };
            break;
          case 'array-contains':
            // PostgreSQL array contains operator
            where[filter.field] = { [Op.contains]: [filter.value] };
            break;
          case 'array-contains-any':
            where[filter.field] = { [Op.overlap]: filter.value };
            break;
        }
      }
    }

    const order: Order = orderBy ? [[orderBy.field, orderBy.direction.toUpperCase()]] : [];
    const options: any = { where, order, transaction };
    if (limit) {
      options.limit = limit;
    }

    const results = await (model as any).findAll(options);
    return results.map((r: any) => this.convertToPlainObject(r)) as T[];
  }

  /**
   * Batch get documents by IDs (much faster than individual queries)
   */
  async getBatchByIds<T>(
    collectionPath: string,
    ids: string[]
  ): Promise<Map<string, T>> {
    if (ids.length === 0) {
      return new Map();
    }

    const model = this.getModel(collectionPath);
    const results = await (model as any).findAll({
      where: { id: { [Op.in]: ids } },
    });

    const map = new Map<string, T>();
    for (const result of results) {
      const plain = this.convertToPlainObject(result) as T;
      map.set((plain as any).id, plain);
    }
    return map;
  }

  /**
   * Run a transaction
   */
  async runTransaction<T>(callback: (transaction: Transaction) => Promise<T>): Promise<T> {
    const sequelize = this.userModel.sequelize;
    if (!sequelize) {
      throw new Error('Sequelize instance not available');
    }
    const transaction = await sequelize.transaction();
    try {
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get batch instance for batch operations
   */
  batch() {
    // Sequelize doesn't have a batch API like Firestore, but we can use transactions
    return {
      commit: async () => {
        // Transactions are handled per-operation in Sequelize
      },
    };
  }

  // ========== Model-specific helpers ==========

  getModel(collectionPath: string): typeof UserModel | typeof QuizModel | typeof QuestionModel | typeof AnswerModel | typeof VoiceLineModel {
    switch (collectionPath) {
      case 'users':
        return this.userModel;
      case 'quizzes':
        return this.quizModel;
      case 'questions':
        return this.questionModel;
      case 'answers':
        return this.answerModel;
      case 'voice_lines':
        return this.voiceLineModel;
      default:
        throw new Error(`Unknown collection: ${collectionPath}`);
    }
  }

  // ========== Helper methods ==========

  /**
   * Convert Sequelize model instance to plain object with ISO date strings
   */
  private convertToPlainObject(instance: any): any {
    const plain = instance.get({ plain: true });
    
    // Convert Date objects to ISO strings
    for (const key in plain) {
      if (plain[key] instanceof Date) {
        plain[key] = plain[key].toISOString();
      } else if (Array.isArray(plain[key])) {
        plain[key] = plain[key].map((item: any) => {
          if (item instanceof Date) {
            return item.toISOString();
          }
          return item;
        });
      }
    }
    
    return plain;
  }

  // ========== Specialized query methods ==========

  /**
   * Get questions by quiz ID (optimized)
   */
  async getQuestionsByQuizId(quizId: string): Promise<any[]> {
    const results = await this.questionModel.findAll({
      where: { quiz_id: quizId },
      order: [['order_index', 'ASC']],
    });
    return results.map(r => this.convertToPlainObject(r));
  }

  /**
   * Get current active question for a quiz
   */
  async getCurrentActiveQuestion(quizId: string): Promise<any | null> {
    const result = await this.questionModel.findOne({
      where: {
        quiz_id: quizId,
        is_active: true,
        status: 'live',
      },
      limit: 1,
    });
    return result ? this.convertToPlainObject(result) : null;
  }

  /**
   * Get answers by question ID with user data (optimized JOIN)
   */
  async getAnswersByQuestionId(questionId: string): Promise<any[]> {
    const results = await this.answerModel.findAll({
      where: { 
        question_id: questionId,
        deleted_at: { [Op.is]: null }, // Exclude soft-deleted answers
      },
      include: [{
        model: this.userModel,
        as: 'user',
        attributes: ['id', 'email', 'in_game_name', 'profile_image_url'],
      }],
      order: [['response_time', 'ASC NULLS LAST']],
    });
    return results.map(r => {
      const plain = this.convertToPlainObject(r);
      return {
        ...plain,
        user_email: plain.user?.email || null,
      };
    });
  }

  /**
   * Get leaderboard for a quiz (optimized SQL query)
   */
  async getQuizLeaderboard(quizId: string, hiddenEmails: string[] = []): Promise<any[]> {
    const db = this.answerModel.sequelize!;
    
    // Build WHERE clause
    let whereClause = 'a.quiz_id = :quizId AND a.deleted_at IS NULL';
    const replacements: any = { quizId };
    
    if (hiddenEmails.length > 0) {
      whereClause += ' AND u.email NOT IN (:hiddenEmails)';
      replacements.hiddenEmails = hiddenEmails;
    }

    // Use raw SQL for better control over table references
    const query = `
      SELECT 
        a.user_id,
        u.email as user_email,
        COALESCE(u.in_game_name, u.full_name, 'Unknown') as user_name,
        SUM(a.score) as total_score,
        COUNT(a.id) as total_answers,
        SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) as correct_answers,
        AVG(a.response_time) as average_response_time
      FROM answers a
      INNER JOIN users u ON a.user_id = u.id
      WHERE ${whereClause}
      GROUP BY a.user_id, u.email, u.in_game_name, u.full_name
      ORDER BY total_score DESC, average_response_time ASC
    `;

    const results = await db.query(query, {
      replacements,
      type: QueryTypes.SELECT,
    }) as any[];

    return results.map(r => ({
      user_id: r.user_id,
      user_name: r.user_name,
      user_email: r.user_email || '',
      total_score: parseInt(String(r.total_score || '0'), 10),
      total_answers: parseInt(String(r.total_answers || '0'), 10),
      correct_answers: parseInt(String(r.correct_answers || '0'), 10),
      average_response_time: Math.round(parseFloat(String(r.average_response_time || '0'))),
    }));
  }

  /**
   * Get combined leaderboard across all quizzes (optimized SQL query)
   */
  async getCombinedLeaderboard(hiddenEmails: string[] = []): Promise<any[]> {
    const db = this.answerModel.sequelize!;

    // Use raw SQL for better performance with complex aggregations
    const whereConditions = [
      'a.deleted_at IS NULL',
      'a.excluded_from_combined = false', // Exclude answers marked as excluded from combined leaderboard
      'q.excluded_from_combined_leaderboard = false', // Exclude answers from quizzes marked as excluded
      'q.deleted_at IS NULL' // Exclude soft-deleted quizzes
    ];
    if (hiddenEmails.length > 0) {
      whereConditions.push(`u.email NOT IN (${hiddenEmails.map(() => '?').join(', ')})`);
    }
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const query = `
      SELECT 
        a.user_id,
        u.email as user_email,
        COALESCE(u.in_game_name, u.full_name, 'Unknown') as user_name,
        SUM(a.score) as total_score,
        COUNT(a.id) as total_answers,
        SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) as correct_answers,
        AVG(a.response_time) as average_response_time,
        COUNT(DISTINCT a.quiz_id) as quizzes_played
      FROM answers a
      INNER JOIN users u ON a.user_id = u.id
      INNER JOIN quizzes q ON a.quiz_id = q.id
      ${whereClause}
      GROUP BY a.user_id, u.email, u.in_game_name, u.full_name
      ORDER BY total_score DESC, quizzes_played DESC
    `;

    const replacements = hiddenEmails.length > 0 ? hiddenEmails : [];
    const results = await db.query(query, {
      replacements,
      type: QueryTypes.SELECT,
    }) as any[];

    return results.map(r => ({
      user_id: r.user_id,
      user_name: r.user_name,
      user_email: r.user_email,
      total_score: parseInt(r.total_score || '0', 10),
      total_answers: parseInt(r.total_answers || '0', 10),
      correct_answers: parseInt(r.correct_answers || '0', 10),
      average_response_time: Math.round(parseFloat(r.average_response_time || '0')),
      quizzes_played: parseInt(r.quizzes_played || '0', 10),
    }));
  }

  /**
   * Get top answers for a question (optimized)
   */
  async getTopAnswers(questionId: string, limit: number = 3): Promise<any[]> {
    const results = await this.answerModel.findAll({
      where: {
        question_id: questionId,
        is_correct: true,
        response_time: { [Op.gt]: 0 },
        deleted_at: { [Op.is]: null }, // Exclude soft-deleted answers
      },
      include: [{
        model: this.userModel,
        as: 'user',
        attributes: ['id', 'in_game_name', 'full_name'],
      }],
      order: [['response_time', 'ASC']],
      limit,
    });

    return results.map((r, index) => {
      const plain = this.convertToPlainObject(r);
      return {
        position: index + 1,
        user_name: plain.user?.in_game_name || plain.user?.full_name || 'Anonymous',
        response_time: plain.response_time || 0,
        score: plain.score || 0,
      };
    });
  }
}

