import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
/**
 * @ignore
 */
export class pageVideoStreamCollector extends EventEmitter {
  page;
  options;
  sessionsStack = [];
  isStreamingEnded = false;
  isFrameAckReceived;
  constructor(page, options) {
    super();
    this.page = page;
    this.options = options;
  }
  get shouldFollowPopupWindow() {
    return this.options.followNewTab;
  }
  async getPageSession(page) {
    try {
      const context = page.target();
      return await context.createCDPSession();
    } catch (error) {
      console.log('Failed to create CDP Session', error);
      return null;
    }
  }
  getCurrentSession() {
    return this.sessionsStack[this.sessionsStack.length - 1];
  }
  addListenerOnTabOpens(page) {
    page.on('popup', (newPage) => this.registerTabListener(newPage));
  }
  removeListenerOnTabClose(page) {
    page.off('popup', (newPage) => this.registerTabListener(newPage));
  }
  async registerTabListener(newPage) {
    await this.startSession(newPage);
    newPage.once('close', async () => await this.endSession());
  }
  async startScreenCast(shouldDeleteSessionOnFailure = false) {
    const currentSession = this.getCurrentSession();
    const quality = Number.isNaN(this.options.quality)
      ? 100
      : Math.max(Math.min(this.options.quality, 100), 0);
    try {
      await currentSession.send('Animation.setPlaybackRate', {
        playbackRate: 1,
      });
      await currentSession.send('Page.startScreencast', {
        everyNthFrame: 1,
        format: this.options.format || 'jpeg',
        quality: quality,
      });
    } catch (e) {
      if (shouldDeleteSessionOnFailure) {
        this.endSession();
      }
    }
  }
  async stopScreenCast() {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      return;
    }
    await currentSession.send('Page.stopScreencast');
  }
  async startSession(page) {
    const pageSession = await this.getPageSession(page);
    if (!pageSession) {
      return;
    }
    try {
      await this.stopScreenCast();
    } catch (e) {
      const session = this.getCurrentSession();
      const sessionId = session?.id() || 'unknown';
      const url = page.url();
      const timestamp = new Date().toISOString();
      const logFilePath = path.join(process.cwd(), 'cdp-protocol-errors.log');
      const logEntry = `[${timestamp}] Session ID: ${sessionId} | URL: ${url}\nError: ${e.message}\n${'-'.repeat(40)}\n`;
      try {
        fs.appendFileSync(logFilePath, logEntry, 'utf8');
      } catch (fsError) {
        console.error('Failed to write CDP log to file:', fsError.message);
      }
      console.error(
        `Error stopping existing screencast session ${sessionId}`,
        e.message,
      );
      return;
    }
    this.sessionsStack.push(pageSession);
    this.handleScreenCastFrame(pageSession);
    await this.startScreenCast(true);
  }
  async handleScreenCastFrame(session) {
    this.isFrameAckReceived = new Promise((resolve) => {
      session.on(
        'Page.screencastFrame',
        async ({ metadata, data, sessionId }) => {
          if (!metadata.timestamp || this.isStreamingEnded) {
            return resolve();
          }
          const ackPromise = session.send('Page.screencastFrameAck', {
            sessionId: sessionId,
          });
          this.emit('pageScreenFrame', {
            blob: Buffer.from(data, 'base64'),
            timestamp: metadata.timestamp,
          });
          try {
            await ackPromise;
          } catch (error) {
            console.error(
              'Error in sending Acknowledgment for PageScreenCast',
              error.message,
            );
          }
        },
      );
    });
  }
  async endSession() {
    this.sessionsStack.pop();
    await this.startScreenCast();
  }
  async start() {
    await this.startSession(this.page);
    this.page.once('close', async () => await this.endSession());
    if (this.shouldFollowPopupWindow) {
      this.addListenerOnTabOpens(this.page);
    }
  }
  async stop() {
    if (this.isStreamingEnded) {
      return this.isStreamingEnded;
    }
    if (this.shouldFollowPopupWindow) {
      this.removeListenerOnTabClose(this.page);
    }
    await Promise.race([
      this.isFrameAckReceived,
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
    this.isStreamingEnded = true;
    try {
      for (const currentSession of this.sessionsStack) {
        await currentSession.detach();
      }
    } catch (e) {
      console.warn('Error detaching session', e.message);
    }
    return true;
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFnZVZpZGVvU3RyZWFtQ29sbGVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2xpYi9wYWdlVmlkZW9TdHJlYW1Db2xsZWN0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUt0QyxPQUFPLElBQUksTUFBTSxNQUFNLENBQUM7QUFDeEIsT0FBTyxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBRXBCOztHQUVHO0FBQ0gsTUFBTSxPQUFPLHdCQUF5QixTQUFRLFlBQVk7SUFDaEQsSUFBSSxDQUFPO0lBQ1gsT0FBTyxDQUFpQztJQUN4QyxhQUFhLEdBQWtCLEVBQUUsQ0FBQztJQUNsQyxnQkFBZ0IsR0FBRyxLQUFLLENBQUM7SUFFekIsa0JBQWtCLENBQWdCO0lBRTFDLFlBQVksSUFBVSxFQUFFLE9BQXVDO1FBQzdELEtBQUssRUFBRSxDQUFDO1FBQ1IsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7UUFDakIsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7SUFDekIsQ0FBQztJQUVELElBQVksdUJBQXVCO1FBQ2pDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUM7SUFDbkMsQ0FBQztJQUVPLEtBQUssQ0FBQyxjQUFjLENBQUMsSUFBVTtRQUNyQyxJQUFJO1lBQ0YsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQzlCLE9BQU8sTUFBTSxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztTQUN6QztRQUFDLE9BQU8sS0FBSyxFQUFFO1lBQ2QsT0FBTyxDQUFDLEdBQUcsQ0FBQyw4QkFBOEIsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNuRCxPQUFPLElBQUksQ0FBQztTQUNiO0lBQ0gsQ0FBQztJQUVPLGlCQUFpQjtRQUN2QixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGFBQWEs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
