import type { LLOneBot } from './preload'
import { Dict } from 'cosmokit'

declare global {
  var llonebot: LLOneBot
  var LiteLoader: Dict
}