import { FunctionComponent } from 'preact';
import { HTMLAttributes } from 'preact/compat';
import { CategoryItem } from '../../api/menuFunction';

export interface MenuComponentProps extends HTMLAttributes<HTMLDivElement> {
    parentId?: string;
}
export interface CategoryTreeItem extends CategoryItem {
    childCategories?: CategoryTreeItem[];
}
export declare const buildCategoryTree: (items: CategoryItem[], rootId: string) => CategoryTreeItem[];
export declare const MenuComponent: FunctionComponent<MenuComponentProps>;
//# sourceMappingURL=MenuComponent.d.ts.map