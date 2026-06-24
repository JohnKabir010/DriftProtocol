import { Controller, Get, Param } from "@nestjs/common";
import { DistrictsService } from "./districts.service";

@Controller("districts")
export class DistrictsController {
  constructor(private readonly districts: DistrictsService) {}

  @Get()
  list() {
    return this.districts.list();
  }

  @Get(":key")
  get(@Param("key") key: string) {
    return this.districts.get(key);
  }
}
