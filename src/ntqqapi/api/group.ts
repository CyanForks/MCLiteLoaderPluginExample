import { ReceiveCmdS } from '../hook'
import { Group, GroupMember, GroupMemberRole, GroupNotifies, GroupRequestOperateTypes, GroupNotify } from '../types'
import { callNTQQApi, GeneralCallResult, NTQQApiMethod } from '../ntcall'
import { NTQQWindowApi, NTQQWindows } from './window'
import { getSession } from '../wrapper'
import { NTEventDispatch } from '@/common/utils/EventTask'
import { NodeIKernelGroupListener } from '../listeners'
import { NodeIKernelGroupService } from '../services'

export class NTQQGroupApi {
  static async getGroups(forced = false): Promise<Group[]> {
    type ListenerType = NodeIKernelGroupListener['onGroupListUpdate']
    const [, , groupList] = await NTEventDispatch.CallNormalEvent
      <(force: boolean) => Promise<any>, ListenerType>
      (
        'NodeIKernelGroupService/getGroupList',
        'NodeIKernelGroupListener/onGroupListUpdate',
        1,
        5000,
        () => true,
        forced
      )
    return groupList
  }

  static async getGroupMembers(groupQQ: string, num = 3000): Promise<Map<string, GroupMember>> {
    const session = getSession()
    let result: Awaited<ReturnType<NodeIKernelGroupService['getNextMemberList']>>
    if (session) {
      const groupService = session.getGroupService()
      const sceneId = groupService.createMemberListScene(groupQQ, 'groupMemberList_MainWindow')
      result = await groupService.getNextMemberList(sceneId, undefined, num)
    } else {
      const sceneId = await callNTQQApi<string>({
        methodName: NTQQApiMethod.GROUP_MEMBER_SCENE,
        args: [
          {
            groupCode: groupQQ,
            scene: 'groupMemberList_MainWindow',
          },
        ],
      })
      result = await callNTQQApi<
        ReturnType<NodeIKernelGroupService['getNextMemberList']>
      >({
        methodName: NTQQApiMethod.GROUP_MEMBERS,
        args: [
          {
            sceneId,
            num,
          },
          null,
        ],
      })
    }
    if (result.errCode !== 0) {
      throw ('获取群成员列表出错,' + result.errMsg)
    }
    return result.result.infos
  }

  static async getGroupNotifies() {
    // 获取管理员变更
    // 加群通知，退出通知，需要管理员权限
    callNTQQApi<GeneralCallResult>({
      methodName: ReceiveCmdS.GROUP_NOTIFY,
      classNameIsRegister: true,
    }).then()
    return await callNTQQApi<GroupNotifies>({
      methodName: NTQQApiMethod.GET_GROUP_NOTICE,
      cbCmd: ReceiveCmdS.GROUP_NOTIFY,
      afterFirstCmd: false,
      args: [{ doubt: false, startSeq: '', number: 14 }, null],
    })
  }

  static async getGroupIgnoreNotifies() {
    await NTQQGroupApi.getGroupNotifies()
    return await NTQQWindowApi.openWindow<GeneralCallResult & GroupNotifies>(
      NTQQWindows.GroupNotifyFilterWindow,
      [],
      ReceiveCmdS.GROUP_NOTIFY,
    )
  }

  static async getSingleScreenNotifies(num: number) {
    const [_retData, _doubt, _seq, notifies] = await NTEventDispatch.CallNormalEvent
      <(arg1: boolean, arg2: string, arg3: number) => Promise<any>, (doubt: boolean, seq: string, notifies: GroupNotify[]) => void>
      (
        'NodeIKernelGroupService/getSingleScreenNotifies',
        'NodeIKernelGroupListener/onGroupSingleScreenNotifies',
        1,
        5000,
        () => true,
        false,
        '',
        num,
      )
    return notifies
  }

  static async delGroupFile(groupCode: string, files: string[]) {
    const session = getSession()
    return session?.getRichMediaService().deleteGroupFile(groupCode, [102], files)!
  }

  static DelGroupFile = NTQQGroupApi.delGroupFile

  static async handleGroupRequest(flag: string, operateType: GroupRequestOperateTypes, reason?: string) {
    const flagitem = flag.split('|')
    const groupCode = flagitem[0]
    const seq = flagitem[1]
    const type = parseInt(flagitem[2])
    const session = getSession()
    return session?.getGroupService().operateSysNotify(
      false,
      {
        'operateType': operateType, // 2 拒绝
        'targetMsg': {
          'seq': seq,  // 通知序列号
          'type': type,
          'groupCode': groupCode,
          'postscript': reason || ' ' // 仅传空值可能导致处理失败，故默认给个空格
        }
      })
  }

  static async quitGroup(groupQQ: string) {
    const session = getSession()
    return session?.getGroupService().quitGroup(groupQQ)
  }

  static async kickMember(
    groupQQ: string,
    kickUids: string[],
    refuseForever = false,
    kickReason = '',
  ) {
    const session = getSession()
    return session?.getGroupService().kickMember(groupQQ, kickUids, refuseForever, kickReason)
  }

  static async banMember(groupQQ: string, memList: Array<{ uid: string, timeStamp: number }>) {
    // timeStamp为秒数, 0为解除禁言
    const session = getSession()
    return session?.getGroupService().setMemberShutUp(groupQQ, memList)
  }

  static async banGroup(groupQQ: string, shutUp: boolean) {
    const session = getSession()
    return session?.getGroupService().setGroupShutUp(groupQQ, shutUp)
  }

  static async setMemberCard(groupQQ: string, memberUid: string, cardName: string) {
    const session = getSession()
    return session?.getGroupService().modifyMemberCardName(groupQQ, memberUid, cardName)
  }

  static async setMemberRole(groupQQ: string, memberUid: string, role: GroupMemberRole) {
    const session = getSession()
    return session?.getGroupService().modifyMemberRole(groupQQ, memberUid, role)
  }

  static async setGroupName(groupQQ: string, groupName: string) {
    const session = getSession()
    return session?.getGroupService().modifyGroupName(groupQQ, groupName, false)
  }

  static async getGroupAtAllRemainCount(groupCode: string) {
    return await callNTQQApi<
      GeneralCallResult & {
        atInfo: {
          canAtAll: boolean
          RemainAtAllCountForUin: number
          RemainAtAllCountForGroup: number
          atTimesMsg: string
          canNotAtAllMsg: ''
        }
      }
    >({
      methodName: NTQQApiMethod.GROUP_AT_ALL_REMAIN_COUNT,
      args: [
        {
          groupCode,
        },
        null,
      ],
    })
  }

  static async removeGroupEssence(GroupCode: string, msgId: string) {
    const session = getSession()
    // 代码没测过
    // 需要 ob11msgid->msgId + (peer) -> msgSeq + msgRandom
    let MsgData = await session?.getMsgService().getMsgsIncludeSelf({ chatType: 2, guildId: '', peerUid: GroupCode }, msgId, 1, false)
    let param = {
      groupCode: GroupCode,
      msgRandom: parseInt(MsgData?.msgList[0].msgRandom!),
      msgSeq: parseInt(MsgData?.msgList[0].msgSeq!)
    }
    // GetMsgByShoretID(ShoretID) -> MsgService.getMsgs(Peer,MsgId,1,false) -> 组出参数
    return session?.getGroupService().removeGroupEssence(param)
  }

  static async addGroupEssence(GroupCode: string, msgId: string) {
    const session = getSession()
    // 代码没测过
    // 需要 ob11msgid->msgId + (peer) -> msgSeq + msgRandom
    let MsgData = await session?.getMsgService().getMsgsIncludeSelf({ chatType: 2, guildId: '', peerUid: GroupCode }, msgId, 1, false)
    let param = {
      groupCode: GroupCode,
      msgRandom: parseInt(MsgData?.msgList[0].msgRandom!),
      msgSeq: parseInt(MsgData?.msgList[0].msgSeq!)
    }
    // GetMsgByShoretID(ShoretID) -> MsgService.getMsgs(Peer,MsgId,1,false) -> 组出参数
    return session?.getGroupService().addGroupEssence(param)
  }
}
