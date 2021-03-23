export type ModelSubscription = () => void | (() => void);

export interface ModelSubscriptions {
  [key: string]: ModelSubscription | ModelSubscriptions;
}

//   ok
