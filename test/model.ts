import { timer } from "rxjs";
import { createRequiredArg } from "../src/arg";
import { ModelBase } from "../src/model";

class FakeModel extends ModelBase<{
  foo: string;
  bar: number;
}> {
  public defaultArgs() {
    return {
      arg1: "arg1",
      arg2: 2,
      arg3: createRequiredArg("arg3"),
      arg4: createRequiredArg<number>(),
    };
  }

  public initialState() {
    return {
      state1: this.args.arg1,
      state2: this.args.arg2,
      state3: this.args.arg3,
      state4: this.args.arg4,
      foo: "foo",
      bar: 0,
    };
  }

  public selectors() {
    return {
      fooAndBar: () => this.state.foo + this.state.bar,
    };
  }

  public reducers() {
    return {
      setState1: (value: string) => {
        this.state.state1 = value;
      },
      increaseState2: () => {
        this.state.state2 += 1;
      },
      foobar: (value: string) => {
        this.state.foo = value;
      },
    };
  }

  public effects() {
    return {
      setState1WithTimeout: async (payload: {
        value: string;
        timeout?: number;
      }) => {
        await timer(payload.timeout ?? 10).toPromise();
        await this.actions.setState1.dispatch(payload.value);
        return this.state.state1;
      },
      foobar: async () => {
        return this.getters.fooAndBar;
      },
    };
  }
}
