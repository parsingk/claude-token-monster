# token-monster

Claude Code 에서 토큰을 쓸수록 자라는 몬스터를 키우는 mod 입니다.
몬스터는 입력칸 위를 좌우로 걸어 다닙니다.

## 설치

**user 스코프**로 설치합니다. 그러면 어느 폴더에서 Claude Code 를 열어도 몬스터가 함께 다닙니다.

셸에서:

```
claude plugin install token-monster --marketplace parsingk/claude-token-monster --scope user
```

또는 Claude Code 터미널 세션의 입력칸에서:

```
/plugin install token-monster --marketplace parsingk/claude-token-monster
```

marketplace 를 추가할지 물으면 `y`, 설치 범위를 물으면 **user** 를 고릅니다. 그 세션부터 바로 켜집니다.

데스크톱 앱에서는(`/plugin` 이 동작하지 않음): 입력칸 옆 + → Plugins → Add marketplace 에
`parsingk/claude-token-monster` 를 넣고 → Add plugin.

## 업데이트

```
claude plugin marketplace update claude-token-monster
claude plugin update token-monster --scope user
```

그다음 세션에서 `/reload-plugins` 를 입력하거나 Claude Code 를 다시 시작하면 새 버전이 적용됩니다.
키우던 몬스터와 코인은 그대로 남습니다.

## 놀이 방법

- 처음에는 알 하나가 있습니다. 토큰 3,000개를 쓰면 풀·불·물·전기 시작 몬스터 4마리 중 하나가 깨어납니다.
- Claude 가 답할 때마다 쓴 토큰이 코인과 경험치가 됩니다.
  토큰 1,000개 = 1코인, 토큰 100개 = 경험치 1 (cache read 토큰은 1/10 만 칩니다).
- 레벨업하고, 진화 레벨에 닿으면 진화합니다.
  진화할 때는 입력칸 위에서 약 8초 동안 연출이 나옵니다: "…어라?" → 진화 전후 모습이 흰빛으로 깜빡임 → 반짝이와 축하 문구.
- 전설 몬스터는 이름이 금색으로 표시됩니다.
- `/monster` 또는 입력칸 위 `가방` 버튼으로 가방·상점을 엽니다.
  - 상점: 알 3,000, 성장사탕 2,000, 진화의 돌 5종(불꽃·물결·번개·새싹·달빛) 각 5,000, 연결끈 8,000
  - 산 알은 토큰 1,000,000개를 쓰면 깨어나며, 진화 전 단계 몬스터가 나옵니다(1% 확률로 전설).
- 몬스터는 모두 151마리입니다. 진화 방법은 레벨·돌·연결끈 세 가지입니다.
- 진행 상황은 각자의 PC 에 저장되어 세션이 바뀌어도 이어집니다.

## 알에서 나오는 몬스터

| 알 | 깨어나는 데 드는 토큰 | 나오는 몬스터 | 확률 |
|---|---|---|---|
| 처음 알 | 3,000개 | 시작 몬스터 4마리: 새싹뿔(풀) · 불씨룡(불) · 물방울게(물) · 찌릿여우(전기) | 각 25% |
| 상점 알 (3,000코인) | 1,000,000개 | 진화 전 단계 몬스터 70마리 (시작 몬스터 4마리 포함) | 합쳐서 99%, 한 마리당 약 1.41% |
| | | 전설 5마리: 태양사자 · 월광고래 · 뇌운룡 · 고대수목 · 환상별 | 합쳐서 1%, 한 마리당 0.2% |

- 진화한 몬스터(2단·3단)는 알에서 나오지 않습니다. 진화시켜야 얻을 수 있습니다.
- 이미 가진 몬스터가 다시 나올 수 있습니다.
- 알이 깨어나는 데 필요한 토큰은 함께 다니는지와 상관없이 가방 속 모든 알에 똑같이 쌓입니다.

## 고치기

- 몬스터 목록·진화: `hooks/data.ts`
- 밸런스(코인·경험치·가격·부화 토큰): `hooks/game.ts` 맨 위 상수
- 모습: `hooks/sprite.ts`, 걷는 속도: `hooks/register.tsx` 의 `WALK_MS`

테스트: `claude plugin test .`
