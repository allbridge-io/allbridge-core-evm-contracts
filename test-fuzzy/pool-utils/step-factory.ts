import { StepInterface } from './step';
// @ts-ignore
import * as G from 'generatorics';
import { getRandomListElement } from '../utils';

interface StepTemplate {
  type: new (...args: any[]) => StepInterface;
  config: any[];
}

export class StepFactory {
  readonly steps: StepInterface[] = [];

  constructor(stepTemplates: StepTemplate[]) {
    for (const stepTemplate of stepTemplates) {
      this.steps.push(...StepFactory.createAllStepsFromTemplate(stepTemplate));
    }
  }

  public static randomElementConfig(list: any[], numberOfElements = 1) {
    return {
      list,
      random: true,
      numberOfParams: numberOfElements,
    };
  }

  static createAllStepsFromTemplate(
    stepTemplate: StepTemplate,
  ): StepInterface[] {
    const expanded: StepInterface[] = [];

    const expandConstructorArgs = (index: number, current: string[]) => {
      if (index === stepTemplate.config.length) {
        // all config elements have been processed
        // create a Step with the current list of constructor arguments
        // eslint-disable-next-line new-cap
        expanded.push(new stepTemplate.type(...current));
      } else {
        const configItem = stepTemplate.config[index];
        if (typeof configItem === 'object' && configItem.random) {
          // configItem is a template for adding constructor arguments from a list of options
          // create a new list of arguments for each option
          // prettier-ignore
          for (const option of G.permutation(configItem.list, configItem.numberOfParams)) {
            expandConstructorArgs(index + 1, [...current, ...option]);
          }
        } else {
          // configItem is a constructor argument
          // add it to the current list
          expandConstructorArgs(index + 1, [...current, configItem]);
        }
      }
    };
    expandConstructorArgs(0, []);
    return expanded;
  }

  createRandomStep(): StepInterface {
    return getRandomListElement(this.steps);
  }
}
