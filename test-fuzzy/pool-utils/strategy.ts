import { StepInterface } from './step';

export class Strategy {
  steps: StepInterface[] = [];
  beforeRun = async () => {};
  beforeStep = async (index: number, step: StepInterface) => {
    console.log(`${index + 1}. Running ${step.describe()}`);
  };

  afterStep = async () => {};
  afterRun = async () => {};

  isAborted = false;

  addStep(step: StepInterface): Strategy {
    this.steps.push(step);
    return this;
  }

  addSteps(...steps: StepInterface[]): Strategy {
    this.steps.push(...steps);
    return this;
  }

  async runSteps(): Promise<void> {
    this.isAborted = false;
    await this.beforeRun();
    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      await this.beforeStep(i, step);
      await step.run();
      await this.afterStep();
      if (this.isAborted) {
        break;
      }
    }
    await this.afterRun();
  }

  async tryRunSteps(): Promise<void> {
    this.isAborted = false;
    await this.beforeRun();
    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      await this.beforeStep(i, step);
      try {
        await step.run();
        await this.afterStep();
      } catch (e) {
        console.error(e);
      }
      if (this.isAborted) {
        break;
      }
    }
    await this.afterRun();
  }

  abortRun() {
    this.isAborted = true;
  }

  logSteps(): void {
    console.log('---');
    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      console.log(`${i + 1}. ${step.describe()}`);
    }
    console.log('---');
  }
}
