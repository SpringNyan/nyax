export type Subscription = () => void | (() => void);

export interface Subscriptions {
  [key: string]: Subscription | Subscriptions;
}
