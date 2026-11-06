// Review draft only. Not the runtime validator or a second game-rule implementation.
// Bind these generics to the single rule module after its public API is agreed.
export type WithoutActor<Command> = Command extends { actorId: string }
  ? Omit<Command, 'actorId'>
  : never

export interface RulesPort<State, Command, Event, Reason extends string> {
  applyCommand(state: State, command: Command):
    | { readonly ok: true; readonly state: State; readonly events: readonly Event[] }
    | { readonly ok: false; readonly reason: Reason }
}

// Keep projection independently testable; never serialize State or Event directly.
export interface PlayerProjection<State, View> {
  forPlayer(state: State, authenticatedPlayerId: string): View
}

type Envelope = { readonly v: 1; readonly requestId: string }

export type ClientMessage<Action> = Envelope & (
  | { readonly type: 'room.join'; readonly roomId: string }
  | { readonly type: 'session.resume'; readonly roomId: string; readonly resumeToken: string }
  | { readonly type: 'ping' }
  | { readonly type: 'state.sync'; readonly roomId: string; readonly gameId: string }
  | {
      readonly type: 'game.command'
      readonly roomId: string
      readonly gameId: string
      readonly expectedRevision: number
      readonly action: Action
    }
)

export type GameMessage<View, Reason extends string> =
  | {
      readonly v: 1
      readonly type: 'game.snapshot'
      readonly roomId: string
      readonly gameId: string
      readonly revision: number
      readonly view: View
    }
  | {
      readonly v: 1
      readonly type: 'command.result'
      readonly requestId: string
      readonly gameId: string
      readonly revision: number
      readonly result:
        | { readonly ok: true }
        | { readonly ok: false; readonly code: Reason | 'STALE_REVISION' | 'REQUEST_ID_REUSED' | 'NOT_AUTHORIZED' }
    }
