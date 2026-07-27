import { FlowDirection } from '@prisma/client';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'CategoryFlow', async: false })
export class CategoryFlowValidator implements ValidatorConstraintInterface {
  validate(flowDirection: FlowDirection, args: ValidationArguments): boolean {
    if (flowDirection !== FlowDirection.INFLOW) {
      return true;
    }

    const object = args.object as Record<string, unknown>;
    const isCogs = object.isCogs === true;
    const isVariable = object.isVariable === true;
    const isDirectCost = object.isDirectCost === true;

    return !(isCogs || isVariable || isDirectCost);
  }

  defaultMessage(): string {
    return 'INFLOW categories cannot have isCogs, isVariable, or isDirectCost set to true. These flags are only valid for OUTFLOW categories.';
  }
}
