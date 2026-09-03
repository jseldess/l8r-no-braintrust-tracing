import { wrapTracedTool } from '../braintrust'
import {
  userService,
  orderService,
  paymentService,
  planService,
  refundService,
} from '../services'
import { ToolName, ToolParameters } from './tools'

const DEMO_USER_ID = 'user_demo_001'

// Wrap each tool execution with Braintrust tracing
const executeGetAccountBalance = wrapTracedTool(async function get_account_balance() {
  return userService.getAccountBalance(DEMO_USER_ID)
})

const executeGetOrders = wrapTracedTool(async function get_orders(
  params: ToolParameters['get_orders']
) {
  return orderService.getOrders(DEMO_USER_ID, {
    status: params.status,
    merchantCategory: params.category,
    limit: params.limit || 10,
  })
})

const executeGetOrderDetails = wrapTracedTool(async function get_order_details(
  params: ToolParameters['get_order_details']
) {
  return orderService.getOrderById(params.order_id, DEMO_USER_ID)
})

const executeGetInstallmentPlans = wrapTracedTool(async function get_installment_plans(
  params: ToolParameters['get_installment_plans']
) {
  return planService.getPlans(DEMO_USER_ID, { status: params.status })
})

const executeGetPlanDetails = wrapTracedTool(async function get_plan_details(
  params: ToolParameters['get_plan_details']
) {
  return planService.getPlanById(params.plan_id, DEMO_USER_ID)
})

const executeGetPaymentHistory = wrapTracedTool(async function get_payment_history(
  params: ToolParameters['get_payment_history']
) {
  return paymentService.getPaymentHistory(DEMO_USER_ID, {
    status: params.status,
    limit: params.limit,
  })
})

const executeGetPaymentDetails = wrapTracedTool(async function get_payment_details(
  params: ToolParameters['get_payment_details']
) {
  return paymentService.getPaymentById(params.payment_id, DEMO_USER_ID)
})

const executeRetryPayment = wrapTracedTool(async function retry_payment(
  params: ToolParameters['retry_payment']
) {
  return paymentService.retryPayment(params.payment_id, DEMO_USER_ID)
})

const executeModifyPlan = wrapTracedTool(async function modify_plan(
  params: ToolParameters['modify_plan']
) {
  return planService.modifyPlan(
    params.plan_id,
    DEMO_USER_ID,
    params.action,
    params.new_date ? new Date(params.new_date) : undefined
  )
})

const executeRequestRefund = wrapTracedTool(async function request_refund(
  params: ToolParameters['request_refund']
) {
  return refundService.requestRefund(
    DEMO_USER_ID,
    params.order_id,
    params.reason,
    params.amount
  )
})

// Main tool executor
export async function executeTool(
  toolName: ToolName,
  parameters: Record<string, unknown>
): Promise<{ result: unknown; error?: string }> {
  try {
    let result: unknown

    switch (toolName) {
      case 'get_account_balance':
        result = await executeGetAccountBalance()
        break
      case 'get_orders':
        result = await executeGetOrders(parameters as ToolParameters['get_orders'])
        break
      case 'get_order_details':
        result = await executeGetOrderDetails(parameters as ToolParameters['get_order_details'])
        break
      case 'get_installment_plans':
        result = await executeGetInstallmentPlans(parameters as ToolParameters['get_installment_plans'])
        break
      case 'get_plan_details':
        result = await executeGetPlanDetails(parameters as ToolParameters['get_plan_details'])
        break
      case 'get_payment_history':
        result = await executeGetPaymentHistory(parameters as ToolParameters['get_payment_history'])
        break
      case 'get_payment_details':
        result = await executeGetPaymentDetails(parameters as ToolParameters['get_payment_details'])
        break
      case 'retry_payment':
        result = await executeRetryPayment(parameters as ToolParameters['retry_payment'])
        break
      case 'modify_plan':
        result = await executeModifyPlan(parameters as ToolParameters['modify_plan'])
        break
      case 'request_refund':
        result = await executeRequestRefund(parameters as ToolParameters['request_refund'])
        break
      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }

    return { result }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { result: null, error: errorMessage }
  }
}
