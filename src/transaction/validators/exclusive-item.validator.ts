import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
} from 'class-validator';

@ValidatorConstraint({ name: 'ExclusiveItem', async: false })
export class ExclusiveItemValidator implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as Record<string, unknown>;
    const hasItemId = obj.itemId !== undefined && obj.itemId !== null;
    const hasCostItemId =
      obj.costItemId !== undefined && obj.costItemId !== null;
    return !(hasItemId && hasCostItemId);
  }

  defaultMessage(): string {
    return 'itemId y costItemId no pueden enviarse simultáneamente';
  }
}

export function ExclusiveItem(): (target: Function) => void {
  return function (target: Function) {
    registerDecorator({
      target,
      propertyName: '',
      name: 'ExclusiveItem',
      constraints: [],
      validator: ExclusiveItemValidator,
    });
  };
}
