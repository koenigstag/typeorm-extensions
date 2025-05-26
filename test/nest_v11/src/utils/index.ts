export const selectElements = <T>(
  array: T[],
  condition: 'even' | 'odd' | ((val: any, index: number, arr: T[]) => boolean),
) => {
  return array.filter((val, index, arr) =>
    typeof condition === 'function'
      ? condition(val, index, arr)
      : condition === 'even'
        ? index % 2 === 0
        : index % 2 !== 0,
  );
};
