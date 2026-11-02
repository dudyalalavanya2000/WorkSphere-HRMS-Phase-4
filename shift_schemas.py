
from datetime import datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


ShiftName = Literal["Morning", "Evening", "Night"]


class ShiftCreate(BaseModel):
    name: ShiftName
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def validate_shift_times(self):
        if self.start_time == self.end_time:
            raise ValueError(
                "Shift start time and end time cannot be identical"
            )
        return self


class ShiftResponse(BaseModel):
    id: int
    name: str
    start_time: time
    end_time: time
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmployeeShiftAssign(BaseModel):
    employee_id: int = Field(gt=0)
    shift_id: int = Field(gt=0)


class EmployeeShiftResponse(BaseModel):
    id: int
    employee_id: int
    shift_id: int
    assigned_at: datetime
    employee_username: str
    shift_name: str
    shift_start_time: time
    shift_end_time: time
