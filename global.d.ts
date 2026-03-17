declare module "msgreader" {
  interface MsgFileData {
    subject?: string;
    senderName?: string;
    senderSmtpAddress?: string;
    senderEmail?: string;
    body?: string;
    bodyHTML?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }

  class MsgReader {
    constructor(fileContent: ArrayBuffer | Buffer);
    getFileData(): MsgFileData;
  }

  export default MsgReader;
}
