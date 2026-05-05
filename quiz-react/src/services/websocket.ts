import { io, Socket } from 'socket.io-client';
import { environment } from '../config/environment';
import { quizAuthService, type AuthUser } from './auth';

type EventListener = (...args: any[]) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventListener>> = new Map();
  private isConnected: boolean = false;
  private currentUserId: string | null = null;
  private joinedQuizRooms: Set<string> = new Set();

  constructor() {
    // Subscribe to auth changes to manage connection
    // The subscribe method calls the listener immediately with current user if available
    quizAuthService.subscribe((user: AuthUser | null) => {
      if (user && !this.socket) {
        // User logged in - connect
        this.connect(user.id);
      } else if (!user && this.socket) {
        // User logged out - disconnect
        this.disconnect();
      }
    });
  }

  private connect(userId: string) {
    if (this.socket?.connected) {
      return; // Already connected
    }

    // Use dedicated WebSocket URL from environment
    const wsUrl = environment.wsUrl;
    
    if (!wsUrl) {
      return;
    }
    
    // Construct socket URL with /quiz namespace
    const socketUrl = `${wsUrl}/quiz`;
    
    try {
      this.socket = io(socketUrl, {
        // Force WebSocket transport for lower latency (no polling fallback)
        transports: ['websocket'],
        // Reduce upgrade timeout to fail faster if WebSocket isn't available
        upgrade: false,
        // Enable auto-reconnection with shorter delays
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        autoConnect: true,
      });
    } catch (error) {
      return;
    }

    this.currentUserId = userId;

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.notifyListeners('connected', {});
      
      // Rejoin any quiz rooms we were in before reconnect
      this.joinedQuizRooms.forEach((quizId) => {
        this.joinQuiz(quizId);
      });
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.notifyListeners('disconnected', { reason });
    });

    this.socket.on('error', (error) => {
      // Forward error to listeners
      this.notifyListeners('error', error);
    });

    // Forward all socket events to registered listeners
    this.setupEventForwarding();
  }

  private setupEventForwarding() {
    if (!this.socket) return;

    // List of events to forward
    const eventsToForward = [
      'joined-quiz',
      'question-live',
      'question-ended',
      'answer-submitted',
      'answer-rejected',
      'leaderboard-updated',
      'question-winner',
      'quiz-winners',
      'error',
      'quiz-status-changed', // Add this event for quiz status changes
      'user-banned', // Add this event for user ban notifications
    ];

    eventsToForward.forEach((eventName) => {
      this.socket!.on(eventName, (...args) => {
        this.notifyListeners(eventName, ...args);
      });
    });
  }

  private disconnect() {
    if (this.socket) {
      // Leave all quiz rooms
      this.joinedQuizRooms.forEach((quizId) => {
        this.socket?.emit('leave-quiz', { quizId });
      });
      this.joinedQuizRooms.clear();

      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentUserId = null;
    }
  }

  /**
   * Join a quiz room
   */
  joinQuiz(quizId: string) {
    if (!this.socket || !this.isConnected || !this.currentUserId) {
      return;
    }

    if (this.joinedQuizRooms.has(quizId)) {
      return; // Already joined
    }

    const joinData = {
      quizId,
      userId: this.currentUserId,
    };

    this.socket.emit('join-quiz', joinData);

    this.joinedQuizRooms.add(quizId);
  }

  /**
   * Leave a quiz room
   */
  leaveQuiz(quizId: string) {
    if (!this.socket || !this.isConnected) {
      return;
    }

    if (this.joinedQuizRooms.has(quizId)) {
      const leaveData = { quizId };

      this.socket.emit('leave-quiz', leaveData);
      this.joinedQuizRooms.delete(quizId);
    }
  }

  /**
   * Subscribe to a WebSocket event
   */
  on(event: string, listener: EventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(listener);
        if (eventListeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  /**
   * Emit event to all listeners
   */
  private notifyListeners(event: string, ...args: any[]) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => {
        try {
          listener(...args);
        } catch (error) {
          // Error in listener
        }
      });
    }
  }

  /**
   * Emit a message to the server
   */
  emitToServer(event: string, ...args: any[]) {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit(event, ...args);
  }

  /**
   * Get current connection status
   */
  get connected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Get the underlying socket instance (use with caution)
   */
  get socketInstance(): Socket | null {
    return this.socket;
  }
}

export const webSocketService = new WebSocketService();

