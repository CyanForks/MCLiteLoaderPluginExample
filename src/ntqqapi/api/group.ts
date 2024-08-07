import { ReceiveCmdS } from '../hook'
import { Group, GroupMember, GroupMemberRole, GroupNotifies, GroupNotify, GroupRequestOperateTypes } from '../types'
import { callNTQQApi, GeneralCallResult, NTQQApiClass, NTQQApiMethod } from '../ntcall'
import { deleteGroup, uidMaps } from '../../common/data'
import { dbUtil } from '../../common/db'
import { log } from '../../common/utils/log'
import { NTQQWindowApi, NTQQWindows } from './window'
import { getSession } from '../wrapper'

export class NTQQGroupApi {
  static async activateMemberListChange() {
    return await callNTQQApi<GeneralCallResult>({
      methodName: NTQQApiMethod.ACTIVATE_MEMBER_LIST_CHANGE,
      classNameIsRegister: true,
      args: [],
    })
  }

  static async activateMemberInfoChange() {
    return await callNTQQApi<GeneralCallResult>({
      methodName: NTQQApiMethod.ACTIVATE_MEMBER_INFO_CHANGE,
      classNameIsRegister: true,
      args: [],
    })
  }

  static async getGroupAllInfo(groupCode: string, source: number = 4) {
    return await callNTQQApi<GeneralCallResult & Group>({
      methodName: NTQQApiMethod.GET_GROUP_ALL_INFO,
      args: [
        {
          groupCode,
          source
        },
        null,
      ],
    })
  }

  static async getGroups(forced = false) {
    // let cbCmd = ReceiveCmdS.GROUPS
    // if (process.platform != 'win32') {
    //   cbCmd = ReceiveCmdS.GROUPS_STORE
    // }
    const result = await callNTQQApi<{
      updateType: number
      groupList: Group[]
    }>({
      methodName: NTQQApiMethod.GROUPS,
      args: [{ force_update: forced }, undefined],
      cbCmd: [ReceiveCmdS.GROUPS, ReceiveCmdS.GROUPS_STORE],
      afterFirstCmd: false,
    })
    log('get groups result', result)
    return result.groupList
  }

  static async getGroupMembers(groupQQ: string, num = 3000): Promise<Map<string, GroupMember>> {
    const session = getSession()
    const groupService = session?.getGroupService()
    const sceneId = groupService?.createMemberListScene(groupQQ, 'groupMemberList_MainWindow')
    const result = await groupService?.getNextMemberList(sceneId!, undefined, num)
    if (result?.errCode !== 0) {
      throw ('获取群成员列表出错,' + result?.errMsg)
    }
    return result.result.infos
  }

  static async getGroupMembersInfo(groupCode: string, uids: string[], forceUpdate: boolean = false) {
    return await callNTQQApi<GeneralCallResult>({
      methodName: NTQQApiMethod.GROUP_MEMBERS_INFO,
      args: [
        {
          forceUpdate,
          groupCode,
          uids
        },
        null,
      ],
    })
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

  static async handleGroupRequest(seq: string, operateType: GroupRequestOperateTypes, reason?: string) {
    const notify = await dbUtil.getGroupNotify(seq)
    if (!notify) {
      throw `${seq}对应的加群通知不存在`
    }
    // delete groupNotifies[seq]
    return await callNTQQApi<GeneralCallResult>({
      methodName: NTQQApiMethod.HANDLE_GROUP_REQUEST,
      args: [
        {
          doubt: false,
          operateMsg: {
            operateType: operateType, // 2 拒绝
            targetMsg: {
              seq: seq, // 通知序列号
              type: notify.type,
              groupCode: notify.group.groupCode,
              postscript: reason,
            },
          },
        },
        null,
      ],
    })
  }

  static async quitGroup(groupQQ: string) {
    const result = await callNTQQApi<GeneralCallResult>({
      methodName: NTQQApiMethod.QUIT_GROUP,
      args: [{ groupCode: groupQQ }, null],
    })
    if (result.result === 0) {
      deleteGroup(groupQQ)
    }
    return result
  }

  static async kickMember(
    groupQQ: string,
    kickUids: string[],
    refuseForever: boolean = false,
    kickReason: string = '',
  ) {
    return await callNTQQApi<GeneralCallResult>({
      methodName: NTQQApiMethod.KICK_MEMBER,
      args: [
        {
          groupCode: groupQQ,
          kickUids,
          refuseForever,
          kickReason,
        },
      ],
    })
  }

  static async banMember(groupQQ: string, memList: Array<{ uid: string, timeStamp: number }>) {
    // timeStamp为秒数, 0为解除禁言
    return await callNTQQApi<GeneralCallResult>({
      methodName: NTQQApiMethod.MUTE_MEMBER,
      args: [
        {
          groupCode: groupQQ,
          memList,
        },
      ],
    })
  }

  static async banGroup(groupQQ: string, shutUp: boolean) {
    return await callNTQQApi<GeneralCallResult>({
      methodName: NTQQApiMethod.MUTE_GROUP,
      args: [
        {
          groupCode: groupQQ,
          shutUp,
        },
        null,
      ],
    })
  }

  static async setMemberCard(groupQQ: string, memberUid: string, cardName: string) {
    NTQQGroupApi.activateMemberListChange().then().catch(log)
    const res = await callNTQQApi<GeneralCallResult>({
      methodName: NTQQApiMethod.SET_MEMBER_CARD,
      args: [
        {
          groupCode: groupQQ,
          uid: memberUid,
          cardName,
        },
        null,
      ],
    })
    NTQQGroupApi.getGroupMembersInfo(groupQQ, [memberUid], true).then().catch(log)
    return res
  }

  static async setMemberRole(groupQQ: string, memberUid: string, role: GroupMemberRole) {
    return await callNTQQApi<GeneralCallResult>({
      methodName: NTQQApiMethod.SET_MEMBER_ROLE,
      args: [
        {
          groupCode: groupQQ,
          uid: memberUid,
          role,
        },
        null,
      ],
    })
  }

  static async setGroupName(groupQQ: string, groupName: string) {
    return await callNTQQApi<GeneralCallResult>({
      methodName: NTQQApiMethod.SET_GROUP_NAME,
      args: [
        {
          groupCode: groupQQ,
          groupName,
        },
        null,
      ],
    })
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

  // 头衔不可用
  static async setGroupTitle(groupQQ: string, uid: string, title: string) {
    return await callNTQQApi<GeneralCallResult>({
      methodName: NTQQApiMethod.SET_GROUP_TITLE,
      args: [
        {
          groupCode: groupQQ,
          uid,
          title,
        },
        null,
      ],
    })
  }

  static publishGroupBulletin(groupQQ: string, title: string, content: string) { }

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
