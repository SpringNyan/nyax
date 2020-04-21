import { timer } from "rxjs";
import { createRequiredArg } from "../src/arg";
import { createModelBase, mergeModels, mergeSubModels } from "../src/model";
import { Dependencies } from "./dependencies";

const ModelBase = createModelBase<Dependencies>();

class FakeModel1 extends ModelBase {
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

class FakeModel2 extends ModelBase {
  public defaultArgs() {
    return {
      arg5: "arg1",
      arg6: 2,
      arg7: createRequiredArg("arg3"),
      arg8: createRequiredArg<number>(),
    };
  }

  public initialState() {
    return {
      state5: this.args.arg5,
      state6: this.args.arg6,
      state7: this.args.arg7,
      state8: this.args.arg8,
      foo2: "foo",
      bar2: 0,
    };
  }

  public selectors() {
    return {
      fooAndBar2: () => this.state.foo2 + this.state.bar2,
    };
  }

  public reducers() {
    return {
      setState5: (value: string) => {
        this.state.state5 = value;
      },
      increaseState6: () => {
        this.state.state6 += 1;
      },
      foobar2: (value: string) => {
        this.state.foo2 = value;
      },
    };
  }

  public effects() {
    return {
      setState5WithTimeout: async (payload: {
        value: string;
        timeout?: number;
      }) => {
        await timer(payload.timeout ?? 10).toPromise();
        await this.actions.setState5.dispatch(payload.value);
        return this.state.state5;
      },
      foobar2: async () => {
        return this.getters.fooAndBar2;
      },
    };
  }
}

const FakeModel = mergeModels(
  mergeSubModels({
    fake1: FakeModel1,
    fake2: FakeModel2,
  }),
  FakeModel1,
  FakeModel2
);

const fakeModel = new FakeModel();
fakeModel;
