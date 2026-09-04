import { ChatCompletionTool } from 'openai/resources/chat/completions'

// Tool definitions for the l8r customer service chatbot
export const chatbotTools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_account_balance',
      description: 'Get the user\'s account balance, credit limit, and available credit. Use this when the user asks about their balance, available credit, or credit limit.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_orders',
      description: 'Get a list of the user\'s orders. Can be filtered by status or category.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'completed', 'cancelled', 'refunded'],
            description: 'Filter orders by status',
          },
          category: {
            type: 'string',
            description: 'Filter orders by merchant category (e.g., Electronics, Apparel)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of orders to return (default: 10)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_order_details',
      description: 'Get detailed information about a specific order, including its payment plan and any refund requests.',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The ID of the order to look up',
          },
        },
        required: ['order_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_installment_plans',
      description: 'Get a list of the user\'s installment payment plans. Can filter by status.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'paused', 'completed', 'cancelled'],
            description: 'Filter plans by status',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_plan_details',
      description: 'Get detailed information about a specific installment plan, including payment schedule and progress.',
      parameters: {
        type: 'object',
        properties: {
          plan_id: {
            type: 'string',
            description: 'The ID of the installment plan to look up',
          },
        },
        required: ['plan_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_payment_history',
      description: 'Get the user\'s payments, including the merchant each payment belongs to and, for failed payments, the reason it failed. Defaults to completed payments. Use status "failed" to find failed or declined payments - this is the tool to use when the user asks why a payment failed, or about a missed or declined payment for a specific merchant.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['paid', 'failed', 'scheduled', 'pending'],
            description: 'Filter payments by status (default: paid). Use "failed" for payments that did not go through.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of payments to return (default: 20)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_payment_details',
      description: 'Get detailed information about a specific payment.',
      parameters: {
        type: 'object',
        properties: {
          payment_id: {
            type: 'string',
            description: 'The ID of the payment to look up',
          },
        },
        required: ['payment_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'retry_payment',
      description: 'Retry a failed payment. Only works for payments with status "failed".',
      parameters: {
        type: 'object',
        properties: {
          payment_id: {
            type: 'string',
            description: 'The ID of the failed payment to retry',
          },
        },
        required: ['payment_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'modify_plan',
      description: 'Modify an installment plan. Can pause, resume, or reschedule the next payment.',
      parameters: {
        type: 'object',
        properties: {
          plan_id: {
            type: 'string',
            description: 'The ID of the installment plan to modify',
          },
          action: {
            type: 'string',
            enum: ['pause', 'resume', 'reschedule'],
            description: 'The action to perform on the plan',
          },
          new_date: {
            type: 'string',
            description: 'For reschedule action: the new payment date in ISO format (e.g., 2025-02-15)',
          },
        },
        required: ['plan_id', 'action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_refund',
      description: 'Submit a refund request for an order. Orders must be within 30 days for refund eligibility.',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The ID of the order to refund',
          },
          reason: {
            type: 'string',
            description: 'The reason for the refund request',
          },
          amount: {
            type: 'number',
            description: 'Optional: specific amount to refund (defaults to full order amount)',
          },
        },
        required: ['order_id', 'reason'],
      },
    },
  },
]

// Map tool names to their parameter types
export type ToolName =
  | 'get_account_balance'
  | 'get_orders'
  | 'get_order_details'
  | 'get_installment_plans'
  | 'get_plan_details'
  | 'get_payment_history'
  | 'get_payment_details'
  | 'retry_payment'
  | 'modify_plan'
  | 'request_refund'

export interface ToolParameters {
  get_account_balance: Record<string, never>
  get_orders: { status?: string; category?: string; limit?: number }
  get_order_details: { order_id: string }
  get_installment_plans: { status?: string }
  get_plan_details: { plan_id: string }
  get_payment_history: { status?: string; limit?: number }
  get_payment_details: { payment_id: string }
  retry_payment: { payment_id: string }
  modify_plan: { plan_id: string; action: 'pause' | 'resume' | 'reschedule'; new_date?: string }
  request_refund: { order_id: string; reason: string; amount?: number }
}
