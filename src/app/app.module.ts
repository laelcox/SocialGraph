import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { D3WrapperComponent } from './custom/d3-wrapper/d3-wrapper.component';
import { SocialGraphComponent } from './custom/social-graph/social-graph.component';


@NgModule({
  declarations: [
    AppComponent,
    D3WrapperComponent,
    SocialGraphComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
