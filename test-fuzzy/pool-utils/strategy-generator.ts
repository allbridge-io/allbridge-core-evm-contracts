// @ts-ignore
import * as G from 'generatorics';
import { StepFactory } from './step-factory';
import { StepInterface } from './step';
import { Strategy } from './strategy';
import { Big } from 'big.js';

export class StrategyGenerator {
  static readonly MAX_NUMBER_OF_STRATEGIES_TO_LOAD = 2e6;
  private readonly stepFactory: StepFactory;
  readonly numberOfStepsInStrategy: number;
  private readonly iterator: any;
  readonly numberOfStrategies: Big;

  constructor(stepFactory: StepFactory, numberOfStepsInStrategy: number) {
    this.stepFactory = stepFactory;
    this.numberOfStepsInStrategy = numberOfStepsInStrategy;
    this.numberOfStrategies = Big(stepFactory.steps.length).pow(
      numberOfStepsInStrategy,
    );
    // prettier-ignore
    if (this.numberOfStrategies.lte(StrategyGenerator.MAX_NUMBER_OF_STRATEGIES_TO_LOAD)) {
      this.iterator = this.createFiniteIterator();
    } else {
      this.iterator = this.createInfiniteIterator();
    }
  }

  *[Symbol.iterator](): Generator<Strategy, void, unknown> {
    for (const stepsCollection of this.iterator) {
      yield new Strategy().addSteps(...stepsCollection);
    }
  }

  private createFiniteIterator() {
    return G.shuffle(
      Array.from(
        G.clone.baseN(this.stepFactory.steps, this.numberOfStepsInStrategy),
      ),
    );
  }

  private *createInfiniteIterator(): IterableIterator<StepInterface[]> {
    while (true) {
      const stepsCollection: StepInterface[] = [];
      for (let i = 0; i < this.numberOfStepsInStrategy; i++) {
        stepsCollection.push(this.stepFactory.createRandomStep());
      }
      yield stepsCollection;
    }
  }
}
