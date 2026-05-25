export const durationPattern = /^(\d+)(ms|s|m|h)$/u;

export function durationToSeconds(value: string): number {
  const match = durationPattern.exec(value);

  if (match === null) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amountText = match[1];
  const unit = match[2];

  if (amountText === undefined || unit === undefined) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amount = Number.parseInt(amountText, 10);

  switch (unit) {
    case "ms":
      return Math.ceil(amount / 1000);
    case "s":
      return amount;
    case "m":
      return amount * 60;
    case "h":
      return amount * 60 * 60;
  }

  throw new Error(`Invalid duration unit: ${unit}`);
}
