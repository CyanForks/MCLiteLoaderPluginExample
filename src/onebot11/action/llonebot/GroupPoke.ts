import { BaseAction, Schema } from '../BaseAction'
import { ActionName } from '../types'
import { getBuildVersion } from '@/common/utils'

interface Payload {
  group_id: number | string
  user_id: number | string
}

export class GroupPoke extends BaseAction<Payload, null> {
  actionName = ActionName.GroupPoke
  payloadSchema = Schema.object({
    group_id: Schema.union([Number, String]).required(),
    user_id: Schema.union([Number, String]).required()
  })

  async _handle(payload: Payload) {
    if (!this.ctx.app.native.checkPlatform() || !this.ctx.app.native.checkVersion()) {
      throw new Error('戳一戳暂时只支持Windows QQ 27333 ~ 275970版本')
    }
    else{
      await this.ctx.app.native.sendGroupPoke(+payload.group_id, +payload.user_id)
    }
    return null
  }
}
