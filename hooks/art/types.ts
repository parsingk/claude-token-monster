// 그림 한 장의 모양. 글자 하나가 점 하나이고, '.' 은 빈 칸이다.
// palette 의 열쇠는 글자 한 자, 값은 소문자 '#rrggbb'.
export type Art = { palette: Record<string, string>; rows: string[] }
