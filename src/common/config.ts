import fs from 'node:fs'
import { Config, OB11Config } from './types'
import { mergeNewProperties } from './utils/helper'
import path from 'node:path'
import { getSelfUin } from './data'
import { DATA_DIR } from './utils'

export class ConfigUtil {
  private readonly configPath: string
  private config: Config | null = null

  constructor(configPath: string) {
    this.configPath = configPath
  }

  getConfig(cache = true) {
    if (this.config && cache) {
      return this.config
    }

    return this.reloadConfig()
  }

  reloadConfig(): Config {
    let ob11Default: OB11Config = {
      httpPort: 3000,
      httpHosts: [],
      httpSecret: '',
      wsPort: 3001,
      wsHosts: [],
      enableHttp: true,
      enableHttpPost: true,
      enableWs: true,
      enableWsReverse: false,
      messagePostFormat: 'array',
      enableHttpHeart: false,
      enableQOAutoQuote: false
    }
    let defaultConfig: Config = {
      enableLLOB: true,
      ob11: ob11Default,
      heartInterval: 60000,
      token: '',
      enableLocalFile2Url: false,
      debug: false,
      log: false,
      reportSelfMessage: false,
      autoDeleteFile: false,
      autoDeleteFileSecond: 60,
      musicSignUrl: '',
      msgCacheExpire: 120
    }

    if (!fs.existsSync(this.configPath)) {
      this.config = defaultConfig
      return this.config
    } else {
      const data = fs.readFileSync(this.configPath, 'utf-8')
      let jsonData: Config = defaultConfig
      try {
        jsonData = JSON.parse(data)
      } catch (e) {
        this.config = defaultConfig
        return this.config
      }
      mergeNewProperties(defaultConfig, jsonData)
      this.checkOldConfig(jsonData.ob11, jsonData, 'httpPort', 'http')
      this.checkOldConfig(jsonData.ob11, jsonData, 'httpHosts', 'hosts')
      this.checkOldConfig(jsonData.ob11, jsonData, 'wsPort', 'wsPort')
      // console.log("get config", jsonData);
      this.config = jsonData
      return this.config
    }
  }

  setConfig(config: Config) {
    this.config = config
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  private checkOldConfig(
    currentConfig: Config | OB11Config,
    oldConfig: Config | OB11Config,
    currentKey: string,
    oldKey: string,
  ) {
    // 迁移旧的配置到新配置，避免用户重新填写配置
    const oldValue = oldConfig[oldKey]
    if (oldValue) {
      currentConfig[currentKey] = oldValue
      delete oldConfig[oldKey]
    }
  }
}

export function getConfigUtil() {
  const configFilePath = path.join(DATA_DIR, `config_${getSelfUin()}.json`)
  return new ConfigUtil(configFilePath)
}
