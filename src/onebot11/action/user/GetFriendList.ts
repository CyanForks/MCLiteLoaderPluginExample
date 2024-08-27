import BaseAction from '../BaseAction'
import { OB11User } from '../../types'
import { OB11Constructor } from '../../constructor'
import { ActionName } from '../types'
import { getBuildVersion } from '@/common/utils/QQBasicInfo'

interface Payload {
  no_cache: boolean | string
}

export class GetFriendList extends BaseAction<Payload, OB11User[]> {
  actionName = ActionName.GetFriendList

  protected async _handle(payload: Payload) {
    const refresh = payload?.no_cache === true || payload?.no_cache === 'true'
    if (getBuildVersion() >= 26702) {
      return OB11Constructor.friendsV2(await this.ctx.ntFriendApi.getBuddyV2(refresh))
    }
    return OB11Constructor.friends(await this.ctx.ntFriendApi.getFriends(refresh))
  }
}

// extend
export class GetFriendWithCategory extends BaseAction<void, any> {
  actionName = ActionName.GetFriendsWithCategory

  protected async _handle(payload: void) {
    if (getBuildVersion() >= 26702) {
      //全新逻辑
      return OB11Constructor.friendsV2(await this.ctx.ntFriendApi.getBuddyV2ExWithCate(true))
    } else {
      throw new Error('this ntqq version not support, must be 26702 or later')
    }
  }
}