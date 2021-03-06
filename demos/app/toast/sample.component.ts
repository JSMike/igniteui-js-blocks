import {Component, Input} from "@angular/core";
import {IgxToastPosition} from "../../../src/toast/toast.component";

@Component({
    moduleId: module.id,
    selector: "toast-sample",
    templateUrl: "sample.component.html",
    styleUrls: ["../app.samples.css", "sample.component.css"]
})
export class IgxToastSampleComponent {
    @Input()
    public toastPosition: IgxToastPosition = IgxToastPosition.Bottom;

    public onShowing(): void {
        console.log("Toast is showing!")
    }

    public showToast(toast, position) {
        switch (position) {
            case 'middle':
                this.toastPosition = IgxToastPosition.Middle;
                break;
            case 'top':
                this.toastPosition = IgxToastPosition.Top;
                break;
            default:
                this.toastPosition = IgxToastPosition.Bottom;
        }
        toast.show();
    }
}