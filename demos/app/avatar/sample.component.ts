import { Component, ViewChild, QueryList, ViewChildren } from "@angular/core";
import { IgxAvatarModule, IgxAvatar } from "../../../src/avatar/avatar.component";
import { IgxBadgeModule, IgxBadge } from "../../../src/badge/badge.component";

@Component({
    selector: "avatar-sample",
    moduleId: module.id,
    templateUrl: "./sample.component.html",
    styleUrls: ['sample.component.css', '../app.samples.css']
})
export class AvatarSampleComponent {
    //@ViewChild(Avatar) avatar: Avatar;
    // Collection of avatars
    @ViewChildren(IgxAvatar) avatar;
    initials: string = 'ZK';
    bgColor: string = '#0375be';
    src: string = '';
    roundShape: string = "true";

    constructor() {
        this.setImageSource();
    }

    setImageSource() {
        this.src = "http://lorempixel.com/300/300/people/" + Math.floor((Math.random() * 5) + 1);
    }

    public changeLink() {
        // for more avatars
        for (let each of this.avatar.toArray()) {
            if(each.src) {
                each.srcImage = "http://lorempixel.com/300/300/people/" + Math.floor((Math.random() * 10) + 1);
            }
        }
    }
}