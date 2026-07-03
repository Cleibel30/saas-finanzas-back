/*
  Warnings:

  - Added the required column `currency` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payment_method` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PAGO_MOVIL', 'TARJETA_DEBITO_CREDITO_PUNTO_VENTA', 'TRANSFERENCIA_BANCARIA_NACIONAL', 'EFECTIVO_BOLIVARES', 'EFECTIVO_DIVISAS', 'TRANSFERENCIAS_INTERNACIONALES_DIRECTAS', 'BILLETERAS_ELECTRONICAS_PROCESADORES', 'CRIPTOMONEDAS');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('BOLIVARES', 'DOLARES');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "currency" "Currency" NOT NULL,
ADD COLUMN     "payment_method" "PaymentMethod" NOT NULL,
ADD COLUMN     "payment_reference" TEXT;
