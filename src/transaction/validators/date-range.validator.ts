import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
} from 'class-validator';

@ValidatorConstraint({ name: 'DateRange', async: false })
export class DateRangeValidator implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as Record<string, unknown>;
    if (obj.startDate === undefined || obj.endDate === undefined) return true;
    const start = new Date(obj.startDate as string);
    const end = new Date(obj.endDate as string);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return true;
    return start <= end;
  }

  defaultMessage(): string {
    return 'startDate no puede ser posterior a endDate';
  }
}

export function DateRange(): (target: Function) => void {
  return function (target: Function) {
    registerDecorator({
      target,
      propertyName: '',
      name: 'DateRange',
      constraints: [],
      validator: DateRangeValidator,
    });
  };
}
