import type { NodePlopAPI } from 'plop'
import pluralize from 'pluralize'

export default async function (plop: NodePlopAPI) {
  plop.setHelper('plural', (word: string) => pluralize(word))

  plop.setGenerator('crud', {
    description: 'Generate CRUD module',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Module name (e.g., User, Product)',
      },
      {
        type: 'input',
        name: 'parent',
        message: 'Parent module (leave blank if none)',
        default: '',
      },
      {
        type: 'confirm',
        name: 'withSchema',
        message: 'Create Mongoose schema?',
        default: true,
      },
    ],
    actions: (data) => {
      const actions: any[] = [
        {
          type: 'add',
          path: 'src/{{#if parent}}{{parent}}/{{/if}}{{kebabCase (plural name)}}/{{kebabCase (plural name)}}.controller.ts',
          templateFile: 'plop-templates/crud/template.controller.ts.hbs',
        },
        {
          type: 'add',
          path: 'src/{{#if parent}}{{parent}}/{{/if}}{{kebabCase (plural name)}}/{{kebabCase (plural name)}}.module.ts',
          templateFile: 'plop-templates/crud/template.module.ts.hbs',
        },
        {
          type: 'add',
          path: 'src/{{#if parent}}{{parent}}/{{/if}}{{kebabCase (plural name)}}/{{kebabCase (plural name)}}.service.ts',
          templateFile: 'plop-templates/crud/template.service.ts.hbs',
        },
      ]

      if (data?.withSchema) {
        actions.push({
          type: 'add',
          path: 'src/{{#if parent}}{{parent}}/{{/if}}{{kebabCase (plural name)}}/_schemas/{{kebabCase name}}.schema.ts',
          templateFile: 'plop-templates/crud/_schemas/template.schema.ts.hbs',
        })
        actions.push({
          type: 'add',
          path: 'src/{{#if parent}}{{parent}}/{{/if}}{{kebabCase (plural name)}}/_dtos/{{kebabCase name}}.dto.ts',
          templateFile: 'plop-templates/crud/_dtos/template.dto.ts.hbs',
        })
      }

      return actions
    },
  })
}
