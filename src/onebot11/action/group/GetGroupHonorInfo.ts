import { WebApi, WebHonorType } from '@/ntqqapi/api'
import { ActionName } from '../types'
import BaseAction from '../BaseAction'

interface Payload {
  group_id: number
  type?: WebHonorType
}

export class GetGroupHonorInfo extends BaseAction<Payload, Array<any>> {
  actionName = ActionName.GetGroupHonorInfo

  protected async _handle(payload: Payload) {
    // console.log(await NTQQUserApi.getRobotUinRange())
    if (!payload.group_id) {
      throw '缺少参数group_id'
    }
    if (!payload.type) {
      payload.type = WebHonorType.ALL
    }
    return await WebApi.getGroupHonorInfo(payload.group_id.toString(), payload.type)
  }
}
