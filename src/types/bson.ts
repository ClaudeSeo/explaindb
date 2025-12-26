/**
 * MongoDB 필드 타입을 나타내는 BSON 타입 enum
 */
export enum BsonType {
  Double = 'double',
  String = 'string',
  Object = 'object',
  Array = 'array',
  BinData = 'binData',
  Undefined = 'undefined',
  ObjectId = 'objectId',
  Boolean = 'boolean',
  Date = 'date',
  Null = 'null',
  Regex = 'regex',
  DBPointer = 'dbPointer',
  JavaScript = 'javascript',
  Symbol = 'symbol',
  JavaScriptWithScope = 'javascriptWithScope',
  Int = 'int',
  Timestamp = 'timestamp',
  Long = 'long',
  Decimal = 'decimal',
  MinKey = 'minKey',
  MaxKey = 'maxKey',
}

/**
 * BSON 타입 코드 매핑 (MongoDB 내부 타입 번호)
 */
export const BSON_TYPE_CODES: Record<number, BsonType> = {
  1: BsonType.Double,
  2: BsonType.String,
  3: BsonType.Object,
  4: BsonType.Array,
  5: BsonType.BinData,
  6: BsonType.Undefined,
  7: BsonType.ObjectId,
  8: BsonType.Boolean,
  9: BsonType.Date,
  10: BsonType.Null,
  11: BsonType.Regex,
  12: BsonType.DBPointer,
  13: BsonType.JavaScript,
  14: BsonType.Symbol,
  15: BsonType.JavaScriptWithScope,
  16: BsonType.Int,
  17: BsonType.Timestamp,
  18: BsonType.Long,
  19: BsonType.Decimal,
  127: BsonType.MaxKey,
  255: BsonType.MinKey,
};

/**
 * JavaScript 값에서 BSON 타입 감지
 */
export function detectBsonType(value: unknown): BsonType {
  if (value === null) {
    return BsonType.Null;
  }
  if (value === undefined) {
    return BsonType.Undefined;
  }
  if (typeof value === 'boolean') {
    return BsonType.Boolean;
  }
  if (typeof value === 'string') {
    return BsonType.String;
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      // MongoDB는 작은 정수는 int32, 큰 정수는 long으로 처리
      if (value >= -2147483648 && value <= 2147483647) {
        return BsonType.Int;
      }
      return BsonType.Long;
    }
    return BsonType.Double;
  }
  if (typeof value === 'bigint') {
    return BsonType.Long;
  }
  if (Array.isArray(value)) {
    return BsonType.Array;
  }
  if (value instanceof Date) {
    return BsonType.Date;
  }
  if (value instanceof RegExp) {
    return BsonType.Regex;
  }
  if (typeof value === 'object') {
    // MongoDB ObjectId 감지
    const obj = value as Record<string, unknown>;
    if (obj._bsontype === 'ObjectId' || obj._bsontype === 'ObjectID') {
      return BsonType.ObjectId;
    }
    if (obj._bsontype === 'Decimal128') {
      return BsonType.Decimal;
    }
    if (obj._bsontype === 'Timestamp') {
      return BsonType.Timestamp;
    }
    if (obj._bsontype === 'Long') {
      return BsonType.Long;
    }
    if (obj._bsontype === 'Binary') {
      return BsonType.BinData;
    }
    if (obj._bsontype === 'MinKey') {
      return BsonType.MinKey;
    }
    if (obj._bsontype === 'MaxKey') {
      return BsonType.MaxKey;
    }
    return BsonType.Object;
  }
  return BsonType.Undefined;
}
