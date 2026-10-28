import { z } from 'zod'

const money = z.number().min(0).max(9999999999.99).refine(
  value => Math.abs(value * 100 - Math.round(value * 100)) < 0.0001,
  'Los importes deben tener como máximo dos decimales.',
)
const identifier = z.uuid()

// Zod omite los campos ajenos al formulario, incluidas relaciones y propietarios.
export const tripSchema = z.object({
  platform_id: identifier.nullable(),
  origin: z.string().trim().min(1, 'Introduce el origen.'),
  destination: z.string().trim().min(1, 'Introduce el destino.'),
  start_at: z.iso.datetime({ offset: true }),
  end_at: z.iso.datetime({ offset: true }).nullable(),
  status: z.enum(['planificado', 'en_curso', 'finalizado', 'cancelado']),
  estimated_budget: money,
  service_price: money,
  service_collected: money,
  kilometers: z.number().int().min(0).max(2147483647).nullable(),
  external_reference: z.string().trim().nullable(),
  notes: z.string().nullable(),
}).refine(v => !v.end_at || Date.parse(v.end_at) >= Date.parse(v.start_at), {
  message: 'La fecha de fin no puede ser anterior al inicio.', path: ['end_at'],
}).refine(v => v.service_collected <= v.service_price, {
  message: 'El importe cobrado no puede superar el precio del servicio.', path: ['service_collected'],
})

export const expenseSchema = z.object({
  expense_type_id: identifier.nullable(),
  spent_at: z.iso.date(),
  amount: money.refine(value => value > 0, 'El importe debe ser mayor que cero.'),
  refundable_amount: money,
  reimbursed_amount: money,
  description: z.string().trim().nullable(),
  notes: z.string().nullable(),
  paid_by_driver: z.boolean(),
}).refine(v => v.refundable_amount <= v.amount, {
  message: 'El importe reembolsable no puede superar el gasto.', path: ['refundable_amount'],
}).refine(v => v.reimbursed_amount <= v.refundable_amount, {
  message: 'El reembolso recibido no puede superar el importe reembolsable.', path: ['reimbursed_amount'],
})
