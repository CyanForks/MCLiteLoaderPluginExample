import { BaseAction, Schema } from '../BaseAction'
import { ActionName } from '../types'
import { parseBool } from '@/common/utils/misc'

interface Payload {
  group_id: number | string
  enable: boolean
}

export default class SetGroupWholeBan extends BaseAction<Payload, null> {
  actionName = ActionName.SetGroupWholeBan
  payloadSchema = Schema.object({
    group_id: Schema.union([Number, String]).required(),
    enable: Schema.union([Boolean, Schema.transform(String, parseBool)]).default(true)
  })

  protected async _handle(payload: Payload): Promise<null> {
    await this.ctx.ntGroupApi.banGroup(payload.group_id.toString(), payload.enable)
    return null
  }
}
