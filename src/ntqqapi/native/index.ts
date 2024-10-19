import { Context } from 'cordis'
import { Dict } from 'cosmokit'
import { getBuildVersion } from '@/common/utils/misc'
import { TEMP_DIR } from '@/common/globalVars'
import { copyFile } from 'fs/promises'
import path from 'node:path'
import addon from './external/crychic-win32-x64.node?asset'

export class Native {
  private crychic?: Dict

  constructor(private ctx: Context) {
    ctx.on('ready', () => {
      this.start()
    })
  }

  checkPlatform() {
    return process.platform === 'win32' && process.arch === 'x64'
  }

  checkVersion() {
    const version = getBuildVersion()
    // 27333—27597
    return version >= 27333 && version < 28060
  }

  async start() {
    if (this.crychic) {
      return
    }
    if (!this.checkPlatform()) {
      return
    }
    if (!this.checkVersion()) {
      return
    }
    try {
      const fileName = path.basename(addon)
      const dest = path.join(TEMP_DIR, fileName)
      try {
        await copyFile(addon, dest)
      } catch (e) {
        // resource busy or locked?
        this.ctx.logger.warn(e)
      }
      this.crychic = require(dest)
      this.crychic!.init()
    } catch (e) {
      this.ctx.logger.warn('crychic 加载失败', e)
    }
  }

  async sendFriendPoke(uin: number) {
    if (!this.crychic) return
    this.crychic.sendFriendPoke(uin)
    await this.ctx.ntMsgApi.fetchUnitedCommendConfig(['100243'])
  }

  async sendGroupPoke(groupCode: number, memberUin: number) {
    if (!this.crychic) return
    this.crychic.sendGroupPoke(memberUin, groupCode)
    await this.ctx.ntMsgApi.fetchUnitedCommendConfig(['100243'])
  }
}
