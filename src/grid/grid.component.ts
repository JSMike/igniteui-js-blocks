import { IgxDropEvent } from "../directives/dragdrop.directive";
import { DataAccess } from "../data-operations/data-container";
import { CommonModule } from "@angular/common";
import {
    AfterContentInit,
    ChangeDetectorRef,
    Component,
    ComponentFactory,
    ComponentFactoryResolver,
    ComponentRef,
    ContentChildren,
    DoCheck,
    ElementRef,
    EventEmitter,
    Input,
    IterableDiffer,
    IterableDiffers,
    NgModule,
    OnDestroy,
    OnInit,
    Output,
    QueryList,
    Renderer,
    ViewChild,
    ViewContainerRef
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Subscription } from "rxjs/Rx";

// grid helper components and directives
import { IgxColumnComponent } from "./column.component";
import {
    IgxCellBodyComponent,
    IgxCellFooterComponent,
    IgxCellHeaderComponent,
    IgxCellFooterTemplateDirective,
    IgxCellHeaderTemplateDirective,
    IgxCellTemplateDirective,
    IgxColumnFilteredEvent,
    IgxColumnFilteringComponent,
    IgxColumnSortedEvent,
    IgxColumnSortingDirective
} from "./grid.common";
import { IgxPaginatorComponent, IgxPaginatorEvent } from "./paginator.component";

import {
    DataContainer,
    DataState,
    FilteringExpression,
    IgxDialog,
    IgxDialogModule,
    IgxDirectivesModule,
    IgxIconModule,
    PagingState,
    SortingDirection,
    SortingExpression
} from "../../src/main";
import { DataType, DataUtil } from "../data-operations/data-util";


export interface IgxGridBindingBehavior {
    process: Function;
}

// grid events

export interface IgxGridColumnInitEvent {
    column: IgxColumnComponent;
}

export interface IgxGridDataProcessingEvent {
    state: DataState;
}

export interface IgxGridRowSelectionEvent {
    row: IgxGridRow;
}

export interface IgxGridCellSelectionEvent {
    cell: IgxGridCell;
}

export interface IgxGridFilterEvent {
    column: IgxColumnComponent;
    expression: FilteringExpression;
}

export interface IgxGridEditEvent {
    row: IgxGridRow;
}

export interface IgxGridSortEvent {
    column: IgxColumnComponent;
    direction: SortingDirection;
    expression: SortingExpression;
}

export interface IgxGridRow {
    index: number;
    record: any;
    element: HTMLElement;
    cells: IgxGridCell[];
}

export interface IgxGridCell {
    rowIndex: number;
    columnField: string;
    dataItem: any;
    element: HTMLElement;
}

/**
 *
 *
 * @export
 * @class IgxGridComponent
 * @implements {OnInit}
 * @implements {AfterContentInit}
 * @implements {DoCheck}
 * @implements {OnDestroy}
 */
@Component({
    moduleId: module.id,
    selector: "igx-grid",
    templateUrl: "grid.component.html"
})
export class IgxGridComponent implements OnInit, AfterContentInit, DoCheck, OnDestroy {

    protected static nextId: number = 1;
    @Input() get data(): any[] {
        return this._data;
    };

    set data(value: any[]) {
        this._data = value;
        this.dataContainer.data = value;
        this.shouldDataBind = true;
    }

    @Input() public perPage: number = 25;

    @Input() public state: DataState = {};

    @Input() get paging(): boolean {
        return this._paging;
    }

    set paging(value: boolean) {
        this._paging = value;
        if (this._paging) {
            this.state.paging = <PagingState>DataUtil.mergeDefaultProperties(this.state.paging,
                <PagingState>{index: 0, recordsPerPage: this.perPage});
        } else {
            this.state.paging = null;
        }
        this.shouldDataBind = true;
    }

    @Input() public id: string = `igx-grid-${IgxGridComponent.nextId++}`;
    @Input() public autoGenerate: boolean = false;

    // child references
    @ContentChildren(IgxColumnComponent) protected cols: QueryList<IgxColumnComponent>;
    @ViewChild(IgxDialog) public editingModal: IgxDialog;
    @ViewChild(IgxPaginatorComponent) public paginator: IgxPaginatorComponent;

    // event emitters
    @Output() public onEditDone = new EventEmitter<IgxGridEditEvent>();
    @Output() public onFilterDone = new EventEmitter<IgxGridFilterEvent>();
    @Output() public onSortingDone = new EventEmitter<IgxGridSortEvent>();
    @Output() public onMovingDone = new EventEmitter<IgxDropEvent>();
    @Output() public onCellSelection = new EventEmitter<IgxGridCellSelectionEvent>();
    @Output() public onRowSelection = new EventEmitter<IgxGridRowSelectionEvent>();
    @Output() public onPagingDone = new EventEmitter<IgxPaginatorEvent>();
    @Output() public onColumnInit = new EventEmitter<IgxGridColumnInitEvent>();
    @Output() public onBeforeProcess = new EventEmitter<IgxGridBindingBehavior>();

    get columnsToRender(): IgxColumnComponent[] {
        return this.columns.filter((col) => !col.hidden);
    }

    get hasEditableColumns(): boolean {
        return this.columns.some((col) => col.editable);
    }

    get hasSorting(): boolean {
        return this.columns.some((col) => col.sortable);
    }

    get hasFiltering(): boolean {
        return this.columns.some((col) => col.filtering);
    }

    get editableColumns(): IgxColumnComponent[] {
        let res: IgxColumnComponent[] = [];
        this.columns.forEach((col) => {
            if (col.editable) {
                res.push(col);
            }
        });
        return res;
    }
    public dataContainer: DataContainer = new DataContainer([]);
    public columns: IgxColumnComponent[] = [];
    protected selectedRow: any;
    private _data: any[];
    private filteringExpressions: Object = {};
    private sortingExpressions: Object = {};
    private colDiffer: Subscription;
    private _differ: IterableDiffer;
    private _paging: boolean = false;
    private _lastRow: any;
    private shouldDataBind: boolean = false;

    constructor(private _renderer: Renderer,
                private _elementRef: ElementRef,
                private _detector: ChangeDetectorRef,
                private _itDiff: IterableDiffers,
                private _resolver: ComponentFactoryResolver,
                private _viewRef: ViewContainerRef) {
                    this._differ = this._itDiff.find([]).create(null);
                }

    public ngOnInit(): void {
        this.dataContainer.state = this.state;
        if (this.paging) {
            this.state.paging = <PagingState>DataUtil.mergeDefaultProperties(this.state.paging,
                <PagingState>{index: 0, recordsPerPage: this.perPage});
        }
    }

    /**
     * @hidden
     */
    public ngAfterContentInit(): void {
        if (this.data && this.autoGenerate) {
            this.autogenerate();
        } else {
            this.checkColumns();
        }
        this.colDiffer = this.cols.changes.subscribe((_) => {
            this.checkColumns();
            this._detector.markForCheck();
        });

    }

    /**
     * @hidden
     */
    protected checkColumns(): void {
        this.columns = this.cols.toArray();
        this.columns.forEach((col, index) => {
            col.index = index;
            this.onColumnInit.emit({column: col});
        });
    }

    /**
     * @hidden
     */
    public ngDoCheck(): void {
        let diff: IterableDiffer = this._differ.diff(this.data);
        if (this.shouldDataBind || diff) {

            let bindingBehavior: IgxGridBindingBehavior = {
                process: (dataContainer: DataContainer) => {
                    dataContainer.process();
                }
            };
            this.onBeforeProcess.emit(bindingBehavior);
            bindingBehavior.process(this.dataContainer);
            this.shouldDataBind = false;
        }
    }

    /**
     * @hidden
     */
    public ngOnDestroy(): void {
        this.colDiffer.unsubscribe();
    }

    public getColumnByIndex(index: number): any {
        return this.columns[index];
    }

    public getColumnByField(field: string): any {
        return this.columns.find((col) => col.field === field);
    }

    public formatBody(record: any, column: IgxColumnComponent): any {
        if (!column.bodyTemplate) {
            return `${record[column.field]}`;
        }
    }

    public formatHeader(column: IgxColumnComponent): any {
        if (!column.headerTemplate) {
            return `${column.header || column.field}`;
        }
    }

    /**
     * Returns the cell at rowIndex/columnIndex.
     *
     * @param {number} rowIndex
     * @param {number} columnIndex
     * @returns
     *
     * @memberOf IgxGrid
     */
    public getCell(rowIndex: number, columnField: string): IgxGridCell {
        let result: IgxGridCell = {
            rowIndex,
            columnField,
            dataItem: null,
            element: null
        };
        let column: IgxColumnComponent = this.getColumnByField(columnField);
        let colIndex: number = this.columnsToRender.indexOf(column);

        let record: any = this.dataContainer.getRecordByIndex(rowIndex, DataAccess.TransformedData);
        let element: any = this._elementRef.nativeElement.querySelector(`td[data-row="${rowIndex}"][data-col="${colIndex}"]`);

        if (record) {
            result.dataItem = record[column.field];
        }

        if (element) {
            result.element = element;
        }

        return result;
    }

    /**
     * Returns
     *
     * @param {number} rowIndex
     * @returns
     *
     * @memberOf IgxGrid
     */
    public getRow(rowIndex: number): IgxGridRow {
        let result: IgxGridRow = {
            index: rowIndex,
            record: null,
            element: null,
            cells: []
        };

        let colFields: string[] = [];
        this.columns.forEach((col) => colFields.push(col.field));

        let record: any = this.dataContainer.getRecordByIndex(rowIndex, DataAccess.TransformedData);
        let element: any = this._elementRef.nativeElement.querySelector(`tbody > tr[data-row="${rowIndex}"]`);

        if (record) {
            result.record = record;
            Object.keys(record).forEach((field) => {
                if (colFields.indexOf(field) !== -1) {
                    result.cells.push(this.getCell(rowIndex, field));
                }
            });
        }

        if (element) {
            result.element = element;
        }

        return result;
    }

    /**
     * Focuses the grid cell at position row x column.
     * Fires the onCellSelection event.
     *
     * @param {(number | string)} rowIndex      : the index of the row
     * @param {(number | string)} columnIndex   : the index of the column
     *
     * @memberOf IgxGrid
     */
    public focusCell(rowIndex: number | string, columnIndex: number | string): void {
        let cell: HTMLElement = this._elementRef.nativeElement.querySelector(`td[data-row="${rowIndex}"][data-col="${columnIndex}"]`);
        if (cell) {
            this._renderer.invokeElementMethod(cell, "focus", []);
        }
    }

    /**
     * Focuses the grid row at index `index`.
     * Fires the onRowSelection event.
     *
     * @param {(number | string)} index
     *
     * @memberOf IgxGrid
     */
    public focusRow(index: number | string): void {
        let row: HTMLElement = this._elementRef.nativeElement.querySelector(`tbody > tr[data-row="${index}"]`);
        if (row) {
            this._renderer.invokeElementMethod(row, "focus", []);
        }
    }

    /**
     * @hidden
     */

    protected onRowFocus(event: any, index: number): void {
        let el: HTMLElement = event.target;
        this._renderer.setElementAttribute(el, "aria-selected", "true");
        this._renderer.setElementClass(el, "igx-grid__tr--selected", true);
        this.onRowSelection.emit({row: this.getRow(index)});
    }

    protected onRowBlur(event: any): void {
        let el: HTMLElement = event.target;
        this._renderer.setElementAttribute(el, "aria-selected", null);
        this._renderer.setElementClass(el, "igx-grid__tr--selected", false);
    }

    protected onCellFocus(event: any, index: number, columnField: string): void {
        let el: HTMLElement = event.target ? event.target : event;
        this._renderer.setElementAttribute(el, "aria-selected", "true");

        if (!this.getColumnByField(columnField).bodyTemplate) {
            this._renderer.setElementClass(el, "igx-grid__td--selected", true);
            this._renderer.setElementClass(el.parentElement, "igx-grid__tr--selected", true);
        }
        this.onCellSelection.emit({cell: this.getCell(index, columnField)});
    }

    protected onCellBlur(event: any): void {
        let el: HTMLElement = event.target;
        this._renderer.setElementAttribute(el, "aria-selected", null);
        this._renderer.setElementClass(el, "igx-grid__td--selected", false);
        this._renderer.setElementClass(el.parentElement, "igx-grid__tr--selected", false);
    }

    protected editCell(index: number, item: any, row: Object): void {
        if (!this.hasEditableColumns) {
            return;
        }
        this._lastRow = row;

        this.selectedRow = {
            index,
            item,
            row: Object.assign({}, row)
        };
        this.editingModal.open();
    }

    protected processFilter(event: IgxColumnFilteredEvent): void {
        this.filterData(event.value, event.column);
    }

    public filterData(searchTerm: string, column: IgxColumnComponent): void {
        let filterInput: any = searchTerm;

        if (!searchTerm) {
            delete this.filteringExpressions[column.field];
        } else {
            switch(column.dataType) {
            case DataType.Number:
                filterInput = parseFloat(searchTerm);
                break;
            case DataType.Boolean:
                filterInput = Boolean(searchTerm);
                break;
            default:
                break;
            }
            this.filteringExpressions[column.field] = <FilteringExpression> {
                condition: column.filteringCondition,
                fieldName: column.field,
                ignoreCase: column.filteringIgnoreCase,
                searchVal: filterInput,
            };
        }
        let result: FilteringExpression[] = [];
        Object.keys(this.filteringExpressions)
            .forEach((expr) => result.push(this.filteringExpressions[expr]));

        this.dataContainer.state.filtering = {
            expressions: result
        };
        if (this.paging) {
            this.dataContainer.state.paging.index = 0;
        }
        this.shouldDataBind = true;
        this.onFilterDone.emit({
            column,
            expression: this.filteringExpressions[column.field]
        });
    }

    public addRow(rowData: Object, at?: number): void {
        this.dataContainer.addRecord(rowData, at);
        this.shouldDataBind = true;
    }

    public deleteRow(row: Object | number | string): void {
        if (typeof row === "object") {
            this.dataContainer.deleteRecord(row);
        } else if (typeof row === "number") {
            this.dataContainer.deleteRecordByIndex(row);
        } else if (typeof row === "string" && !isNaN(parseInt(row, 10))) {
            this.dataContainer.deleteRecordByIndex(parseInt(row, 10));
        }
        this.shouldDataBind = true;
    }

    public updateRow(index: number, rowData: Object): void {
        this.dataContainer.updateRecordByIndex(index, rowData);
        this.onEditDone.emit({row: this.getRow(index)});
    }

    public updateCell(index: number, columnField: string, value: any): void {
        let row: IgxGridRow = this.getRow(index);
        row.index = this.dataContainer.getIndexOfRecord(row.record);
        row.record[columnField] = value;
        this.updateRow(row.index, row.record);
        this.shouldDataBind = true;
    }

    protected _setValue(field: string, event: any): void {
        this.selectedRow.row[field] = event;
    }

    protected getSortedExpression(column: IgxColumnComponent): number {
        let dir: number = 0;
        if (column.sortable && this.state.sorting) {
            let expr: SortingExpression[] = this.state.sorting.expressions
                .filter((each) => each.fieldName === column.field);
            if (expr && expr.length) {
                dir = expr[0].dir;
            }
        }
        return dir;
    }
    protected cancelEdit(): void {
        this.selectedRow.row = this._lastRow;
        if (this.paging) {
            this.selectedRow.index = this.dataContainer.getIndexOfRecord(this._lastRow);
        }
        this.updateRow(this.selectedRow.index, this.selectedRow.row);
        this.shouldDataBind = true;
        this.editingModal.close();
    }

    protected saveData(): void {
        if (this.paging) {
            this.selectedRow.index = this.dataContainer.getIndexOfRecord(this._lastRow);
        }
        this.updateRow(this.selectedRow.index, this.selectedRow.row);
        this.shouldDataBind = true;
        this.editingModal.close();
    }

    protected moveColumn(event: IgxDropEvent): void {
        this.columns[event.dragData].index = event.dropData;
        this.columns[event.dropData].index = event.dragData;
        let temp: any = this.columns[event.dragData];
        this.columns[event.dragData] = this.columns[event.dropData];
        this.columns[event.dropData] = temp;
        this.onMovingDone.emit(event);
    }

    protected processSort(event: IgxColumnSortedEvent): void {
        this.sortColumn(event.column, event.direction);
    }
    public sortColumn(column: IgxColumnComponent, direction: SortingDirection): void {
        if (direction === SortingDirection.None) {
            delete this.sortingExpressions[column.field];
        } else {
            this.sortingExpressions[column.field] = <SortingExpression> {
                dir: direction,
                fieldName: column.field,
                ignoreCase: true
            };
        }

        let result: SortingExpression[] = [];
        Object.keys(this.sortingExpressions)
            .forEach((expr) => result.push(this.sortingExpressions[expr]));

        this.dataContainer.state.sorting = this.dataContainer.state.sorting || {expressions: []};
        this.dataContainer.state.sorting.expressions = result;
        this.shouldDataBind = true;
        this.onSortingDone.emit({
            column,
            direction,
            expression: this.sortingExpressions[column.field]
        });
    }

    public paginate(page: number): void {
        this.paginator.paginate(page);
    }

    /**
     * @hidden
     */
    protected _paginate(event: IgxPaginatorEvent): void {
        this.dataContainer.state.paging = {
            index: event.currentPage,
            recordsPerPage: event.perPage
        };
        this.shouldDataBind = true;
        this.onPagingDone.emit(event);
    }

    private autogenerate(): void {
        const factory: ComponentFactory<IgxColumnComponent> = this._resolver.resolveComponentFactory(IgxColumnComponent);
        let colFields: any[] = Object.keys(this.data[0]);

        colFields.forEach((field, index) => {
            let ref: ComponentRef<IgxColumnComponent> = this._viewRef.createComponent(factory);
            ref.instance.field = field;
            ref.instance.index = index;
            this.onColumnInit.emit({column: ref.instance});
            this.columns.push(ref.instance);
            ref.changeDetectorRef.detectChanges();
        });
    }

    private navigate(event: any): void {
        let key: string = event.key;
        let row: any = event.target.dataset.row;
        let column: any = event.target.dataset.col;

        row = parseInt(row, 10);
        column = parseInt(column, 10);

        if (key.endsWith("Left")) {
            this.focusCell(row, column - 1);
         } else if (key.endsWith("Right")) {
            this.focusCell(row, column + 1);
        } else if (key.endsWith("Up")) {
            this.focusCell(row - 1, column);
        } else if (key.endsWith("Down")) {
            this.focusCell(row + 1, column);
        }
    }
}

let GRID_DIRECTIVES: any[] = [
    IgxGridComponent,
    IgxColumnComponent,
    IgxColumnFilteringComponent,
    IgxColumnSortingDirective,
    IgxCellTemplateDirective,
    IgxCellFooterTemplateDirective,
    IgxCellBodyComponent,
    IgxCellHeaderComponent,
    IgxCellFooterComponent,
    IgxCellHeaderTemplateDirective,
    IgxPaginatorComponent,
];

@NgModule({
    declarations: GRID_DIRECTIVES,
    entryComponents: [IgxColumnComponent],
    exports: GRID_DIRECTIVES,
    imports: [CommonModule, IgxIconModule, IgxDialogModule, IgxDirectivesModule, FormsModule],
})
export class IgxGridModule {}
