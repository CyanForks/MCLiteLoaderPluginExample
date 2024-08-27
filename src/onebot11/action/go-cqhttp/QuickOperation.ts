import BaseAction from '../BaseAction'
import { handleQuickOperation, QuickOperation, QuickOperationEvent } from '../../helper/quick-operation'
import { ActionName } from '../types'

interface Payload {
  context: QuickOperationEvent,
  operation: QuickOperation
}

export class GoCQHTTHandleQuickOperation extends BaseAction<Payload, null> {
  actionName = ActionName.GoCQHTTP_HandleQuickOperation
  protected async _handle(payload: Payload): Promise<null> {
    handleQuickOperation(this.ctx, payload.context, payload.operation).catch(e => this.ctx.logger.error(e))
    return null
  }
}