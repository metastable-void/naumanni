import {UseCase} from 'almin'

import {encryptText} from 'src/controllers/PGP'
import PublicKeyCache from 'src/infra/PublicKeyCache'
import {postStatusManaged} from 'src/infra/TimelineData'
import {MASTODON_MAX_CONTENT_SIZE} from 'src/constants'

/**
 * DirectMessageを送る
 */
export default class SendDirectMessageUseCase extends UseCase {
  constructor() {
    super()
  }

  /**
   * @override
   * @param {OAuthToken} token
   * @param {Account} self
   * @param {string} message
   * @param {Account[]} recipients
   */
  async execute({token, self, message, in_reply_to_id, recipients}) {
    if(message.length >= MASTODON_MAX_CONTENT_SIZE) {
      // encryptedの場合分割して送るから、ContentSizeはもはや関係ないはずなんだけど...
      throw new Error('__TODO_ERROR_MESSAGE__')
    }

    const targets = [self].concat(recipients)
    const keyIds = []

    // 鍵を集める
    for(const target of targets) {
      if(target.hasPublicKey)
        keyIds.push({keyId: target.publicKeyId, user: target.acct})
    }

    // TODO: 雑よね
    if(keyIds.length == targets.length) {
      // 全員鍵をもっているので、暗号化して送る
      const publicKeys = (await PublicKeyCache.fetchKeys(keyIds))
        .reduce((publicKeys, storedKey) => {
          publicKeys[storedKey.user] = storedKey.readArmored()[0]
          return publicKeys
        }, {})
      await this.sendEncryptedMessage({token, self, message, in_reply_to_id, recipients, publicKeys})
    } else {
      // 鍵もってないのがいるので、plainに送る
      await this.sendPlainMessage({token, self, message, in_reply_to_id, recipients})
    }
  }

  async sendPlainMessage({token, self, message, in_reply_to_id, recipients}) {
    require('assert')(message.length < MASTODON_MAX_CONTENT_SIZE)
    const status = recipients.map((r) => `@${r.acct}`).join(' ') + ' ' + message
    if(status.length >= MASTODON_MAX_CONTENT_SIZE) {
      // to入れるとサイズオーバーしてしまった...
      throw new Error('__TODO_ERROR_MESSAGE__')
    }
    await postStatusManaged(token, {message: {
      status,
      in_reply_to_id,
      visibility: 'direct',
    }})
  }

  async sendEncryptedMessage({token, self, message, in_reply_to_id, recipients, publicKeys}) {
    const encryptedBlocks = await encryptText({
      content: message,
      addresses: recipients.reduce((addresses, recipient) => {
        addresses[recipient.acct] = publicKeys[recipient.acct]
        return addresses
      }, {}),
      senderPublicKey: publicKeys[self.acct],
      maxLength: MASTODON_MAX_CONTENT_SIZE,
    })

    await Promise.all(
      encryptedBlocks.map((block) => {
        postStatusManaged(token, {message: {
          status: block,
          in_reply_to_id,
          visibility: 'direct',
        }})
      })
    )
  }
}
