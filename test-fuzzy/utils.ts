export const randomNumber = (min: number, max: number): number => {
  min = Math.ceil(min);
  max = Math.floor(max);

  return Math.floor(Math.random() * (max - min + 1)) + min;
};
export const randomBool = () => {
  return Math.random() < 0.5;
};

export function getRandomListElement(array: any[]) {
  return array[randomNumber(0, array.length - 1)];
}
