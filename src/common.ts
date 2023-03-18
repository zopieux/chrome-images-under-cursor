export enum Kind {
  Source, Video,
}

export enum From {
  Image, Svg, Canvas, Video, Background, BackgroundCrop, Pseudo, PseudoCrop
}

export interface Entity {
  from: From,
  kind: Kind,
  src: string,
  id?: string,
  w?: number,
  h?: number,
  name?: string,
  duration?: number,
  rendered?: string,
}
