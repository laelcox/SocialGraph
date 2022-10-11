import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SocialGraphComponent } from './social-graph.component';

describe('SocialGraphComponent', () => {
  let component: SocialGraphComponent;
  let fixture: ComponentFixture<SocialGraphComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SocialGraphComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SocialGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
