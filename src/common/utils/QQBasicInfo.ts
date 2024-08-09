import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { systemPlatform } from './system'

export const exePath = process.execPath

function getPKGPath() {
  let p = path.join(path.dirname(exePath), 'resources', 'app', 'package.json')
  if (systemPlatform === 'darwin') {
    p = path.join(path.dirname(path.dirname(exePath)), 'Resources', 'app', 'package.json')
  }
  return p
}

export const pkgInfoPath = getPKGPath()
let configVersionInfoPath: string


if (os.platform() !== 'linux') {
  configVersionInfoPath = path.join(path.dirname(exePath), 'resources', 'app', 'versions', 'config.json')
}
else {
  const userPath = os.homedir()
  const appDataPath = path.resolve(userPath, './.config/QQ')
  configVersionInfoPath = path.resolve(appDataPath, './versions/config.json')
}

if (typeof configVersionInfoPath !== 'string') {
  throw new Error('Something went wrong when load QQ info path')
}

export { configVersionInfoPath }

type QQPkgInfo = {
  version: string
  buildVersion: string
  platform: string
  eleArch: string
}
type QQVersionConfigInfo = {
  baseVersion: string
  curVersion: string
  prevVersion: string
  onErrorVersions: Array<any>
  buildId: string
}

let _qqVersionConfigInfo: QQVersionConfigInfo = {
  'baseVersion': '9.9.9-23361',
  'curVersion': '9.9.9-23361',
  'prevVersion': '',
  'onErrorVersions': [],
  'buildId': '23361',
}

if (fs.existsSync(configVersionInfoPath)) {
  try {
    const _ = JSON.parse(fs.readFileSync(configVersionInfoPath).toString())
    _qqVersionConfigInfo = Object.assign(_qqVersionConfigInfo, _)
  } catch (e) {
    console.error('Load QQ version config info failed, Use default version', e)
  }
}

export const qqVersionConfigInfo: QQVersionConfigInfo = _qqVersionConfigInfo

export const qqPkgInfo: QQPkgInfo = require(pkgInfoPath)
// platform_type: 3,
// app_type: 4,
// app_version: '9.9.9-23159',
// qua: 'V1_WIN_NQ_9.9.9_23159_GW_B',
// appid: '537213764',
// platVer: '10.0.26100',
// clientVer: '9.9.9-23159',

let _appid: string = '537213803'  // 默认为 Windows 平台的 appid
if (systemPlatform === 'linux') {
  _appid = '537213827'
}
// todo: mac 平台的 appid
export const appid = _appid
export const isQQ998: boolean = qqPkgInfo.buildVersion >= '22106'

export function getBuildVersion(): number {
  return +qqPkgInfo.buildVersion
}