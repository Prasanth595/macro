import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionMap,
  type EditorConfig,
  type EditorThemeClasses,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import { type DecoratorComponent, getDecorator } from '../decoratorRegistry';
import { $applyIdFromSerialized } from '../plugins/nodeIdPlugin';

const VERSION = 1;

/** Serialized tag for a routine template's variable slot. */
export const TEMPLATE_VARIABLE_TAG = 'm-template-variable';

export type TemplateVariableInfo = {
  /** The variable's key in its template, such as `urgent_channel`. */
  key: string;
};

export type SerializedTemplateVariableNode = Spread<
  TemplateVariableInfo,
  SerializedLexicalNode
>;

export type TemplateVariableDecoratorProps = TemplateVariableInfo & {
  nodeKey: NodeKey;
  theme: EditorThemeClasses;
};

/**
 * A variable slot in a routine template's instructions. The node knows only
 * its key; whoever renders it supplies the label and the value, if any.
 */
export class TemplateVariableNode extends DecoratorNode<
  DecoratorComponent<TemplateVariableDecoratorProps> | undefined
> {
  __variableKey: string;

  static getType() {
    return 'template-variable';
  }

  isInline(): boolean {
    return true;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  static clone(node: TemplateVariableNode) {
    return new TemplateVariableNode(node.__variableKey, node.__key);
  }

  constructor(variableKey: string, key?: NodeKey) {
    super(key);
    this.__variableKey = variableKey;
  }

  static importJSON(serializedNode: SerializedTemplateVariableNode) {
    const node = $createTemplateVariableNode(serializedNode.key);
    $applyIdFromSerialized(node, serializedNode);
    return node;
  }

  exportJSON(): SerializedTemplateVariableNode {
    return {
      ...super.exportJSON(),
      key: this.__variableKey,
      type: TemplateVariableNode.getType(),
      version: VERSION,
    };
  }

  exportComponentProps(): TemplateVariableInfo {
    return { key: this.__variableKey };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    span.setAttribute('data-template-variable', this.__variableKey);
    return span;
  }

  updateDOM(): boolean {
    return false;
  }

  static importDOM(): DOMConversionMap<HTMLElement> | null {
    return {
      span: (node) =>
        node.hasAttribute('data-template-variable')
          ? {
              conversion: (domNode) => {
                const key = domNode.getAttribute('data-template-variable');
                return key ? { node: $createTemplateVariableNode(key) } : null;
              },
              priority: 1,
            }
          : null,
    };
  }

  exportDOM() {
    const element = document.createElement('span');
    element.setAttribute('data-template-variable', this.__variableKey);
    element.textContent = `{${this.__variableKey}}`;
    return { element };
  }

  getTextContent(): string {
    return `{${this.__variableKey}}`;
  }

  getVariableKey(): string {
    return this.__variableKey;
  }

  decorate(_: LexicalEditor, config: EditorConfig) {
    const decorator =
      getDecorator<TemplateVariableDecoratorProps>(TemplateVariableNode);
    if (decorator) {
      return () =>
        decorator({
          key: this.__variableKey,
          nodeKey: this.getKey(),
          theme: config.theme,
        });
    }
  }
}

export function $createTemplateVariableNode(
  variableKey: string
): TemplateVariableNode {
  return $applyNodeReplacement(new TemplateVariableNode(variableKey));
}

export function $isTemplateVariableNode(
  node: LexicalNode | null | undefined
): node is TemplateVariableNode {
  return node instanceof TemplateVariableNode;
}
