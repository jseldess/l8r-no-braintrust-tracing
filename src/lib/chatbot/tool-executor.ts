import {
  userService,
  orderService,
  paymentService,
  planService,
  refundService,
} from '../services'
import { ToolName, ToolParameters } from './tools'

const DEMO_USER_ID = 'user_demo_001'

async function getAccountBalance() {
  return userService.getAccountBalance(DEMO_USER_ID)
}

async function getOrders(params: ToolParameters['get_orders']) {
  return orderService.getOrders(DEMO_USER_ID, {
    status: params.status,
    merchantCategory: params.category,
    limit: params.limit || 10,
  })
}

async function getOrderDetails(params: ToolParameters['get_order_details']) {
  return orderService.getOrderById(params.order_id, DEMO_USER_ID)
}

async function getInstallmentPlans(params: ToolParameters['get_installment_plans']) {
  return planService.getPlans(DEMO_USER_ID, { status: params.status })
}

async function getPlanDetails(params: ToolParameters['get_plan_details']) {
  return planService.getPlanById(params.plan_id, DEMO_USER_ID)
}

async function getPaymentHistory(params: ToolParameters['get_payment_history']) {
  return paymentService.getPaymentHistory(DEMO_USER_ID, {
    status: params.status,
    limit: params.limit,
  })
}

async function getPaymentDetails(params: ToolParameters['get_payment_details']) {
  return paymentService.getPaymentById(params.payment_id, DEMO_USER_ID)
}

async function retryPayment(params: ToolParameters['retry_payment']) {
  return paymentService.retryPayment(params.payment_id, DEMO_USER_ID)
}

async function modifyPlan(params: ToolParameters['modify_plan']) {
  return planService.modifyPlan(
    params.plan_id,
    DEMO_USER_ID,
    params.action,
    params.new_date ? new Date(params.new_date) : undefined
  )
}

async function requestRefund(params: ToolParameters['request_refund']) {
  return refundService.requestRefund(
    DEMO_USER_ID,
    params.order_id,
    params.reason,
    params.amount
  )
}

// Main tool executor
export async function executeTool(
  toolName: ToolName,
  parameters: Record<string, unknown>
): Promise<{ result: unknown; error?: string }> {
  try {
    let result: unknown

    switch (toolName) {
      case 'get_account_balance':
        result = await getAccountBalance()
        break
      case 'get_orders':
        result = await getOrders(parameters as ToolParameters['get_orders'])
        break
      case 'get_order_details':
        result = await getOrderDetails(parameters as ToolParameters['get_order_details'])
        break
      case 'get_installment_plans':
        result = await getInstallmentPlans(parameters as ToolParameters['get_installment_plans'])
        break
      case 'get_plan_details':
        result = await getPlanDetails(parameters as ToolParameters['get_plan_details'])
        break
      case 'get_payment_history':
        result = await getPaymentHistory(parameters as ToolParameters['get_payment_history'])
        break
      case 'get_payment_details':
        result = await getPaymentDetails(parameters as ToolParameters['get_payment_details'])
        break
      case 'retry_payment':
        result = await retryPayment(parameters as ToolParameters['retry_payment'])
        break
      case 'modify_plan':
        result = await modifyPlan(parameters as ToolParameters['modify_plan'])
        break
      case 'request_refund':
        result = await requestRefund(parameters as ToolParameters['request_refund'])
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
