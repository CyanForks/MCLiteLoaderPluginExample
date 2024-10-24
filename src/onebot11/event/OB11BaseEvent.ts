import { selfInfo } from '@/common/globalVars'

export enum EventType {
  META = 'meta_event',
  REQUEST = 'request',
  NOTICE = 'notice',
  MESSAGE = 'message',
  MESSAGE_SENT = 'message_sent',
}

export abstract class OB11BaseEvent {
  [index: string]: any
  time = Math.floor(Date.now() / 1000)
  self_id = parseInt(selfInfo.uin)
  abstract post_type: EventType
}
