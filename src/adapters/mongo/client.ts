import { MongoClient, type Db } from 'mongodb';
import { logger } from '../../cli/logger';

/**
 * MongoDB 클라이언트 연결 관리
 */

let clientInstance: MongoClient | null = null;

export interface MongoConnection {
  client: MongoClient;
  db: Db;
}

/**
 * MongoDB 연결
 */
export async function connect(uri: string, dbName: string): Promise<MongoConnection> {
  logger.debug(`Connecting to MongoDB: ${uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);

  try {
    const client = new MongoClient(uri, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
    });

    await client.connect();
    clientInstance = client;

    const db = client.db(dbName);

    await db.command({ ping: 1 });
    logger.debug(`Connected to database: ${dbName}`);

    return { client, db };
  } catch (error) {
    const err = error as Error;
    if (err.message.includes('authentication')) {
      throw new Error(`인증 실패: 자격 증명을 확인하세요. ${err.message}`);
    }
    if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
      throw new Error(`연결 실패: MongoDB 서버에 연결할 수 없습니다. URI와 네트워크를 확인하세요.`);
    }
    throw new Error(`MongoDB 연결 실패: ${err.message}`);
  }
}

/**
 * MongoDB 연결 해제
 */
export async function disconnect(): Promise<void> {
  if (clientInstance) {
    await clientInstance.close();
    clientInstance = null;
    logger.debug('Disconnected from MongoDB');
  }
}

/**
 * 현재 클라이언트 인스턴스 반환
 */
export function getClient(): MongoClient | null {
  return clientInstance;
}
