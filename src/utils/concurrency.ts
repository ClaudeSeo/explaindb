/**
 * 제한된 동시성으로 비동기 작업을 실행하는 유틸리티
 *
 * @param items - 처리할 항목 배열
 * @param fn - 각 항목에 대해 실행할 비동기 함수
 * @param maxConcurrency - 최대 동시 실행 수
 * @returns 성공한 결과만 포함된 배열 (에러 발생 건은 제외)
 *
 * @example
 * const urls = ['url1', 'url2', 'url3'];
 * const results = await runWithConcurrency(
 *   urls,
 *   async (url) => fetch(url),
 *   2 // 최대 2개씩만 동시 실행
 * );
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  maxConcurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing: Set<Promise<void>> = new Set();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // 현재 항목에 대한 Promise 생성
    const promise = Promise.resolve()
      .then(() => fn(item, i))
      .then((result) => {
        results[i] = result;
      })
      .catch(() => {
        // 에러 발생 시 무시하고 계속 진행
        // results[i]는 undefined로 남음
      })
      .finally(() => {
        // 완료되면 실행 중 Set에서 제거
        executing.delete(promise);
      });

    executing.add(promise);

    // 동시 실행 수가 maxConcurrency에 도달하면 하나가 완료될 때까지 대기
    if (executing.size >= maxConcurrency) {
      await Promise.race(executing);
    }
  }

  // 모든 작업 완료 대기
  await Promise.allSettled(Array.from(executing));

  // undefined를 제거하고 성공한 결과만 반환
  return results.filter((result): result is R => result !== undefined);
}
