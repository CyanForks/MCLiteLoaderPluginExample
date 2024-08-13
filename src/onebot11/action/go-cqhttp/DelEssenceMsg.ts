
import BaseAction from '../BaseAction';
import { ActionName } from '../types';
import { NTQQGroupApi } from '@/ntqqapi/api/group'
import { MessageUnique } from '@/common/utils/MessageUnique'

interface Payload {
  message_id: number | string
}

export default class GoCQHTTPDelEssenceMsg extends BaseAction<Payload, any> {
  actionName = ActionName.GoCQHTTP_DelEssenceMsg;

  protected async _handle(payload: Payload): Promise<any> {
    if (!payload.message_id) {
      throw Error('message_id不能为空')
    }
    const msg = await MessageUnique.getMsgIdAndPeerByShortId(+payload.message_id)
    if (!msg) {
      throw new Error('msg not found')
    }
    return await NTQQGroupApi.removeGroupEssence(
      msg.Peer.peerUid,
      msg.MsgId,
    )
  }
}
